Tasun v5 FINAL STABLE v42

本包修正：
1. index.html 版次不再卡在舊的 ?v=20260309_xx，改由 tasun-version.json 統一控制。
2. index.html 外部腳本改為自動帶 v 載入，降低快取殘留造成的舊程式重覆發生。
3. 登入表「使用者名稱」改成原生下拉保底模式，避免自製下拉失效時無法展開。
4. UI/版面與既有功能維持不變。

部署方式：
- 直接用本包覆蓋站上同名檔案。
- 至少要一起更新：index.html、tasun-version.json。
