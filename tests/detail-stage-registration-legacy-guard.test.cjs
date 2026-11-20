const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { source, declaration } = require('./helpers/embedded.cjs');

const detail = source('汐東收發文明細表.html');
function contextWithText() {
  const context = vm.createContext({
    r706Text: value => String(value ?? '').replace(/[\t\r\n]+/g, ' ').trim(),
    r777DocKey: value => String(value ?? '').replace(/[\s\u00A0\u3000\-—_./／\\()（）:：]+/g, '').toLowerCase(),
    r706LegacyValue: () => '',
    r706NormalizeStage: value => ({ ...value }),
    r696ExtensionHistory: row => Array.isArray(row['展延歷程']) ? row['展延歷程'] : [],
    r914ArraySource: value => Array.isArray(value) ? value : [],
    r914CompatFill: (current, incoming) => ({ ...incoming, ...current }),
  });
  vm.runInContext('const R706_STAGE_START="起始文件",R706_STAGE_SUPERVISOR="監造回覆",R706_STAGE_CONTRACTOR="統包回覆來文",R706_STAGE_HISTORY_KEY="文件處理歷程",R908_SUPERVISOR_REPLIES_FIELD="監造回覆明細",R846_SUPERVISOR_ISSUE_DATE_FIELD="發文日期(監造)";', context);
  for (const name of [
    'r914CompatDocKey',
    'r914LegacyContractorDocNoAllowed',
    'r706MigrateLegacyStages',
    'r914LegacyCompatibilityRecords',
    'r914MergeHistorySources',
  ]) vm.runInContext(declaration(detail, name), context);
  context.r914FuseLegacyHistorySources = () => {};
  context.r914ResolvedLegacyDocKeys = () => new Set();
  return context;
}

test('legacy extension matching the start document is not exposed as contractor reply stage', () => {
  const c = contextWithText();
  const row = {
    '文號': 'XDL字第1150007338號',
    '展延歷程': [{ '統包申請文號': 'XDL字第1150007338號', '展延次數': 1 }],
  };
  const stages = [{ '階段類型': '起始文件', '文號': row['文號'] }];
  const migrated = c.r706MigrateLegacyStages(row, stages);
  assert.deepEqual(Array.from(migrated, stage => stage['階段類型']), ['起始文件']);
  assert.deepEqual(Array.from(c.r914LegacyCompatibilityRecords(row), stage => stage['文號']), []);
});

test('a distinct legacy contractor reply remains available', () => {
  const c = contextWithText();
  const row = {
    '文號': 'START-1',
    '展延歷程': [{ '統包申請文號': 'REPLY-1', '展延次數': 1 }],
  };
  const migrated = c.r706MigrateLegacyStages(row, [{ '階段類型': '起始文件', '文號': 'START-1' }]);
  assert.equal(migrated.length, 2);
  assert.equal(migrated[1]['階段類型'], '統包回覆來文');
  assert.equal(migrated[1]['文號'], 'REPLY-1');
  assert.equal(c.r914LegacyCompatibilityRecords(row)[0]['文號'], 'REPLY-1');
});

test('canonical unique history keeps its array identity for cached reads', () => {
  const c = contextWithText();
  const history = [{ '階段UID': 'start-1', '文號': 'DOC-1' }];
  const row = { history };
  const result = c.r914MergeHistorySources(row, 'history', ['historyLegacy'], record => record['階段UID']);
  assert.equal(result, history);
  assert.equal(row.history, history);
});

test('canonical duplicate history still merges records', () => {
  const c = contextWithText();
  const row = { history: [{ id: 'same', left: 1 }, { id: 'same', right: 2 }] };
  const merged = c.r914MergeHistorySources(row, 'history', [], record => record.id);
  assert.equal(merged.length, 1);
  assert.deepEqual({ ...merged[0] }, { id: 'same', left: 1, right: 2 });
});
