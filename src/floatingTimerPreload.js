const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("floatingTimer", {
  getState: () => ipcRenderer.invoke("floatingTimer:getState"),
  openMainWindow: () => ipcRenderer.invoke("floatingTimer:openMainWindow"),
  onStateChanged: (callback) => {
    const listener = (_event, timerState) => callback(timerState);
    ipcRenderer.on("floatingTimer:state", listener);
    return () => ipcRenderer.removeListener("floatingTimer:state", listener);
  }
});
