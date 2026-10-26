import jpeg from 'npm:jpeg-js@0.4.4'
export function normalizeJpeg(bytes: Uint8Array): Uint8Array {
  const image = jpeg.decode(bytes, {useTArray:true,maxResolutionInMP:8,maxMemoryUsageInMB:64,formatAsRGBA:true})
  // Pass only pixels and dimensions: do not re-emit original EXIF metadata.
  return jpeg.encode({width:image.width,height:image.height,data:image.data},85).data
}
