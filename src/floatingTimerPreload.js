const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("floatingTimer", {
  getState: () => ipcRenderer.invoke("floatingTimer:getState"),
  openMainWindow: () => ipcRenderer.invoke("floatingTimer:openMainWindow"),
  startDrag: () => ipcRenderer.send("floatingTimer:dragStart"),
  moveDrag: () => ipcRenderer.send("floatingTimer:dragMove"),
  endDrag: () => ipcRenderer.send("floatingTimer:dragEnd"),
  onStateChanged: (callback) => {
    const listener = (_event, timerState) => callback(timerState);
    ipcRenderer.on("floatingTimer:state", listener);
    return () => ipcRenderer.removeListener("floatingTimer:state", listener);
  }
});
