/* Tasun Boot v4-stable (minimal)
   - 只做必要的啟動前檢查/小修正，不改 UI
*/
(function(){
  'use strict';
  // 防止某些環境 bfcache 回來造成事件未重新綁定：標記
  try{ window.__TASUN_BOOT_AT__ = Date.now(); }catch(_){ }
})();
