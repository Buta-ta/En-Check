import jpeg from 'npm:jpeg-js@0.4.4'
import { normalizeJpeg } from './codec.ts'
Deno.test('re-encodes a real JPEG without EXIF and rejects malformed images',()=>{
 const image={width:2,height:2,data:new Uint8Array(16).fill(255),exifBuffer:new Uint8Array([69,120,105,102,0,0,1,2])}
 const original=jpeg.encode(image,90).data
 if(!Reflect.get(jpeg.decode(original),'exifBuffer')) throw Error('Fixture has no EXIF')
 const clean=jpeg.decode(normalizeJpeg(original),{useTArray:true})
 if(clean.width!==2 || clean.height!==2 || Reflect.get(clean,'exifBuffer')) throw Error('Unexpected image/metadata')
 let rejected=false
 try { normalizeJpeg(new Uint8Array([255,216,255])) } catch { rejected=true }
 if(!rejected)throw Error('Malformed image accepted')
})
Deno.test('rejects excessive decoded resolution before pixel allocation',()=>{
 const data=jpeg.encode({width:2,height:2,data:new Uint8Array(16).fill(255)},90).data
 const copy=new Uint8Array(data)
 const offset=copy.findIndex((b,i)=>b===255 && copy[i+1]===192)
 if(offset<0) throw Error('SOF marker missing')
 copy[offset+5]=39;copy[offset+6]=16;copy[offset+7]=39;copy[offset+8]=16
 let rejected=false
 try {normalizeJpeg(copy)}catch{rejected=true}
 if(!rejected)throw Error('Oversized image accepted')
})
