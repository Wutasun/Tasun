'use strict';

const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const html = fs.readFileSync(path.join(__dirname, '..', '捷運汐止東湖線-施工查驗管控表.html'), 'utf8');
const script = html.match(/<script\s+id="tasun-inspection-control-r560-app">([\s\S]*?)<\/script>/i)?.[1];
assert.ok(script, 'inspection control app script exists');

function excelBuilder() {
  const constants = script.match(/var EXCEL_CENTER_FIELDS_R576 = [^;]+;/)?.[0];
  const header = script.match(/function excelHeaderLabelR576\(field\)\{[\s\S]*?\n    \}/)?.[0];
  const builder = script.match(/function buildExcelHtmlR576\(rows, fields, escape\)\{[\s\S]*?\n    \}/)?.[0];
  assert.ok(constants && header && builder, 'Excel export helpers exist');
  return new Function('esc', `${constants}; ${header}; ${builder}; return buildExcelHtmlR576;`)(
    value => String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
  );
}

test('R576 exports three required title lines, wraps requested headers, and omits attachments', () => {
  const output = excelBuilder()([{
    項次: '1', 查驗類別: '施工', 抽查申請單申請日期: '2026/05/15', 抽查申請單編號: 'REQ-01',
    抽查項目: '檢查內容', 抽查系統: '接地系統', 抽查紀錄表編號: 'REC-01',
    '自主檢查表編號(統包)': 'SELF-01', 檢查位置: 'P12-05', 檢查日期: '2026/05/16',
    檢查結果: '合格', 缺失改善通知書: '無', 承辦人: '承辦甲', 附件: 'https://example.invalid/secret', 紙本存放位置: '資料夾'
  }], ['項次', '查驗類別', '抽查申請單申請日期', '抽查申請單編號', '抽查項目', '抽查系統', '抽查紀錄表編號', '自主檢查表編號(統包)', '檢查位置', '檢查日期', '檢查結果', '缺失改善通知書', '承辦人', '附件', '紙本存放位置'], value => String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;'));

  assert.match(output, /新北市政府捷運工程局<\/th><\/tr><tr><th[^>]*>捷運汐止東湖線<\/th><\/tr><tr><th[^>]*>施工抽查申請單-目錄/);
  assert.match(output, /抽查申請單<br>申請日期/);
  assert.match(output, /缺失改善<br>通知書/);
  assert.doesNotMatch(output, /附件|example\.invalid/);
  assert.match(output, /紙本存放位置/);
});

test('R576 centers the specified data columns and keeps inspection item text left aligned', () => {
  const output = excelBuilder()([{
    項次: '1', '抽查申請單申請日期': '2026/05/15', 抽查申請單編號: 'REQ-01',
    抽查項目: '檢查內容', 抽查系統: '接地系統', 抽查紀錄表編號: 'REC-01',
    檢查位置: 'P12-05', 檢查日期: '2026/05/16', 檢查結果: '合格',
    缺失改善通知書: '無', 承辦人: '承辦甲'
  }], ['項次', '抽查申請單申請日期', '抽查申請單編號', '抽查項目', '抽查系統', '抽查紀錄表編號', '檢查位置', '檢查日期', '檢查結果', '缺失改善通知書', '承辦人'], value => String(value ?? ''));

  for (const field of ['項次', '抽查申請單申請日期', '抽查申請單編號', '抽查系統', '抽查紀錄表編號', '檢查位置', '檢查日期', '檢查結果', '缺失改善通知書', '承辦人']) {
    const singleField = excelBuilder()([{ [field]: 'CENTER-VALUE' }], [field], value => String(value ?? ''));
    assert.match(singleField, /<td class="excel-cell excel-center">CENTER-VALUE<\/td>/, field);
  }
  assert.match(output, /<td class="excel-cell excel-left">檢查內容<\/td>/);
});

test('R576 provides print controls and A4 landscape settings for the local print dialog', () => {
  assert.match(html, /data-menu="print">列印 Excel<\/button>/);
  assert.match(script, /function printExcelR576\(\)[\s\S]*?window\.open\("","_blank"\)/);
  assert.match(script, /if\(a==="print"\) printExcelR576\(\)/);
  const output = excelBuilder()([], ['項次'], value => String(value ?? ''));
  assert.match(output, /@page\{size:A4 landscape/);
  assert.match(output, /onclick="window\.print\(\)"[^>]*>列印<\/button>/);
  assert.match(output, /x:Orientation="Landscape"/);
  assert.match(output, /<x:PaperSizeIndex>9<\/x:PaperSizeIndex>/);
});

test('R576 preserves existing resource identity and application script syntax', () => {
  assert.match(html, /data-resource-key="sxdh-inspection-control"/);
  assert.match(html, /data-db-name="tasun_sxdh_inspection_control_idb_v1"/);
  assert.match(script, /data-menu="cloudUpload"/);
  assert.doesNotThrow(() => new Function(script));
});
