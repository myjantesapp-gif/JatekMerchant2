const fs = require("fs");
const Module = require("module");

const originalLoad = Module._load;

Module._load = function loadWithImageSizeCompatibility(
  request,
  parent,
  isMain,
) {
  const loaded = originalLoad.call(this, request, parent, isMain);

  if (request !== "image-size" || loaded.__jatekPathCompatibility) {
    return loaded;
  }

  const imageSize = loaded.imageSize || loaded.default || loaded;
  const compatibleImageSize = (input) =>
    imageSize(typeof input === "string" ? fs.readFileSync(input) : input);

  return {
    ...loaded,
    __esModule: true,
    default: compatibleImageSize,
    imageSize: compatibleImageSize,
    __jatekPathCompatibility: true,
  };
};