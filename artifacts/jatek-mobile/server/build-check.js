const fs = require("fs");
const path = require("path");

const PLATFORMS = ["ios", "android"];
const BUNDLE_ASSET_PATTERN =
  /httpServerLocation:"([^"]+)"[^}]*hash:"([^"]+)"[^}]*name:"([^"]+)"[^}]*type:"([^"]+)"/g;

function normalizeBasePath(value) {
  const basePath = (value || "/").replace(/\/+$/, "");
  return basePath === "/" ? "" : basePath;
}

function pathFromBuildUrl(urlValue, staticRoot, basePath) {
  if (typeof urlValue !== "string" || urlValue.length === 0) {
    throw new Error("missing URL");
  }

  let pathname;
  try {
    pathname = new URL(urlValue, "https://build.invalid").pathname;
  } catch {
    throw new Error(`invalid URL: ${urlValue}`);
  }

  const normalizedBasePath = normalizeBasePath(basePath);
  if (
    normalizedBasePath &&
    pathname !== normalizedBasePath &&
    !pathname.startsWith(`${normalizedBasePath}/`)
  ) {
    throw new Error(`URL does not use the ${normalizedBasePath}/ base path`);
  }

  const relativePath = normalizedBasePath
    ? pathname.slice(normalizedBasePath.length).replace(/^\/+/, "")
    : pathname.replace(/^\/+/, "");
  const outputPath = path.resolve(staticRoot, relativePath);
  const rootWithSeparator = `${staticRoot}${path.sep}`;

  if (outputPath !== staticRoot && !outputPath.startsWith(rootWithSeparator)) {
    throw new Error("URL resolves outside of the static build");
  }

  return { outputPath, relativePath };
}

function getBundleAssetUrls(bundlePath) {
  const bundle = fs.readFileSync(bundlePath, "utf-8");
  const urls = [];

  for (const match of bundle.matchAll(BUNDLE_ASSET_PATTERN)) {
    const location = match[1].replace(/\/+$/, "");
    const filename = `${match[3]}.${match[4]}`;
    urls.push(`${location}/${filename}`);
  }

  return urls;
}

function validateStaticBuild({ staticRoot, basePath }) {
  const errors = [];
  const manifests = {};
  let bundleAssetReferences = 0;

  if (!fs.existsSync(staticRoot) || !fs.statSync(staticRoot).isDirectory()) {
    return {
      ok: false,
      errors: [`Static build directory is missing: ${staticRoot}`],
      manifests,
    };
  }

  for (const platform of PLATFORMS) {
    const manifestPath = path.join(staticRoot, platform, "manifest.json");

    if (!fs.existsSync(manifestPath)) {
      errors.push(`Missing ${platform} manifest`);
      continue;
    }

    let manifest;
    try {
      manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
      manifests[platform] = manifest;
    } catch (error) {
      errors.push(`Invalid ${platform} manifest: ${error.message}`);
      continue;
    }

    let launchAssetPath;
    try {
      const launchAsset = pathFromBuildUrl(
        manifest.launchAsset?.url,
        staticRoot,
        basePath,
      );
      launchAssetPath = launchAsset.outputPath;
      const expectedBundleSuffix = path.posix.join(
        "_expo",
        "static",
        "js",
        platform,
        "bundle.js",
      );

      if (!launchAsset.relativePath.endsWith(expectedBundleSuffix)) {
        errors.push(`${platform} manifest launch asset does not point to its bundle`);
      } else if (
        !fs.existsSync(launchAsset.outputPath) ||
        fs.statSync(launchAsset.outputPath).size === 0
      ) {
        errors.push(`${platform} bundle is missing or empty`);
      }
    } catch (error) {
      errors.push(`Invalid ${platform} launch asset: ${error.message}`);
    }

    for (const [index, asset] of (manifest.assets || []).entries()) {
      if (!asset?.url) {
        continue;
      }

      try {
        const output = pathFromBuildUrl(asset.url, staticRoot, basePath);
        if (!fs.existsSync(output.outputPath) || fs.statSync(output.outputPath).size === 0) {
          errors.push(`${platform} asset ${index} is missing or empty`);
        }
      } catch (error) {
        errors.push(`Invalid ${platform} asset ${index}: ${error.message}`);
      }
    }

    if (launchAssetPath && fs.existsSync(launchAssetPath)) {
      try {
        const bundleAssetUrls = getBundleAssetUrls(launchAssetPath);
        bundleAssetReferences += bundleAssetUrls.length;

        for (const [index, assetUrl] of bundleAssetUrls.entries()) {
          const output = pathFromBuildUrl(assetUrl, staticRoot, basePath);
          if (!fs.existsSync(output.outputPath) || fs.statSync(output.outputPath).size === 0) {
            errors.push(`${platform} bundle asset ${index} is missing or empty`);
          }
        }
      } catch (error) {
        errors.push(`Unable to validate ${platform} bundle assets: ${error.message}`);
      }
    }
  }

  if (bundleAssetReferences === 0) {
    errors.push("No static assets were found in the platform bundles");
  }

  return {
    ok: errors.length === 0,
    errors,
    manifests,
    bundleAssetReferences,
  };
}

module.exports = {
  PLATFORMS,
  getBundleAssetUrls,
  normalizeBasePath,
  validateStaticBuild,
};