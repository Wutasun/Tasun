// 全域物件
window.TasunCloudKit

// 1) 初始化（可重複呼叫；應保持 idempotent）
TasunCloudKit.init({
  appVer: "",                 // string，可空
  resourcesUrl: "tasun-resources.json",
  ui: { enabled:true, hideLockButtons:true, position:"bottom-right" },
  lock: { enabled:false, auto:false }
});

// 2) 掛載一個資源（回傳 controller）
const ctrl = TasunCloudKit.mount({
  resourceKey: "sxdh-notes",  // 對應 tasun-resources.json 的 key

  // v1 merge table 格式欄位
  pk: "k",
  idField: "id",
  counterField: "counter",

  // merge/watch（v1 必須接受這些設定）
  merge: { conflictPolicy:"stash-remote", lock:"none" },
  watch: { intervalSec: 10 },

  // 本地資料來源 / 套用資料
  getLocal: () => ({ counter: N, db: [{id, k, v}, ...] }),
  apply: (payload) => {}
});

// 3) controller（最小保證）
ctrl.pullNow();                       // 立刻拉雲端→觸發 apply
ctrl.saveMerged({ lock:false, mode:"merge" }); // 立刻推雲端（合併）
ctrl.status && ctrl.status();         // 可選
ctrl.destroy && ctrl.destroy();       // 可選
