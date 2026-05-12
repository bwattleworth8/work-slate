const path = require("node:path");

module.exports = async function afterPack(context) {
  if (context.electronPlatformName !== "win32") {
    return;
  }

  const { rcedit } = await import("rcedit");
  const appInfo = context.packager.appInfo;
  const exePath = path.join(context.appOutDir, `${appInfo.productFilename}.exe`);
  const iconPath = path.join(context.packager.projectDir, "build", "icon.ico");
  const version = appInfo.getVersionInWeirdWindowsForm();

  await rcedit(exePath, {
    icon: iconPath,
    "file-version": version,
    "product-version": version,
    "requested-execution-level": "asInvoker",
    "version-string": {
      CompanyName: appInfo.companyName || appInfo.productName,
      FileDescription: appInfo.description || appInfo.productName,
      InternalName: appInfo.productFilename,
      LegalCopyright: appInfo.copyright,
      OriginalFilename: `${appInfo.productFilename}.exe`,
      ProductName: appInfo.productName
    }
  });
};
