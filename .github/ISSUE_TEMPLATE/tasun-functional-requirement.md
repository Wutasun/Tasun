---
name: Tasun 新功能需求 / Functional Requirement Intake
about: 收錄下一輪 Tasun 功能需求；本表本身不授權 implementation
title: "[REQ] "
labels: ""
assignees: ""
---

> 狀態：INTAKE ONLY / NOT APPROVED / NO IMPLEMENTATION AUTHORITY

## 1. 問題說明 / Problem statement

請描述目前遇到的實際問題、錯誤行為或缺少的能力。

-

## 2. 使用情境 / Affected user flow

請描述使用者從哪個頁面、哪個操作開始，經過哪些步驟後遇到問題。

1.
2.
3.

## 3. 影響頁面 / 模組

請勾選或補充。

- [ ] 汐東收發文明細表
- [ ] 汐東收發文登錄表
- [ ] 汐東文件統計表
- [ ] 汐東文件管理表
- [ ] 登入 / 權限
- [ ] 雲端同步
- [ ] 手機版 / 表格 / 舞台
- [ ] 發布 / 版本
- [ ] 其他：

## 4. 目前行為 / Current behavior

-

## 5. 期望行為 / Required behavior

-

## 6. 明確不變項目 / Explicitly unchanged behavior

請列出本需求不得改動的 UI、資料欄位、權限、同步規則、操作流程或其他既有行為。

-

## 7. 資料 / 身分 / 權限影響

請說明是否涉及：

- uid / rev / updatedAt / deleted 等正式資料身分
- 權限繼承
- 登入狀態
- 正式資料 authority
- 去重 / sync

若無，填「無」。

-

## 8. 生命週期 / 雲端 / SelfHeal 影響

請說明是否涉及：

- 頁面開啟 / 關閉 / BFCache
- upload / download / CRUD
- Abort / retry
- scheduler / heavy work
- TasunSelfHealV5 / R268

若無，填「無」。

-

## 9. Desktop / Mobile 影響

-

## 10. 發布影響 / Release impact

請說明本需求是否會修改 release-triggering files、是否需要正式 Exact Auto Release，以及是否需要四頁 build sequence / SHA 驗證。

若無，填「無」。

-

## 11. 驗收標準 / Acceptance criteria

請用可驗證方式描述完成條件。

- [ ]
- [ ]
- [ ]

## 12. 重現資料 / 證據

可附：

- 截圖
- 錄影
- console error
- 操作步驟
- 文件編號 / 測試資料
- 相關舊 PR / commit（僅供追溯，不作為新 authority）

-

## 13. Architecture gate

此區由需求明確後再填寫。

- Existing original authority to modify:
- Authority to retire:
- Call-chain / data-flow impact:
- SelfHeal boundary:
- Failure / abort / retry behavior:
- Duplicate-authority prevention:

## 14. Written spec approval

- [ ] Architecture 已核准
- [ ] Written spec 已完成
- [ ] 使用者已明確核准 written spec

只有三項均成立，才可進入 implementation / TDD。

## 固定規則

- 必須從 written spec 核准當下的最新 `main` 建立 implementation branch。
- 不得從舊 PR、舊 feature branch 或歷史工作分支直接延續為新 authority。
- 維持 Tasun v5、TasunSelfHealV5、R268 固定原則。
- `tasun-version.json` 仍是唯一正式版本 authority。
- 不得因自動 release sequence 而自行推定新的功能 R 編號。
- 未核准 written spec 前，不建立功能程式、不升正式版本、不發布。
