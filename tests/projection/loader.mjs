export async function resolve(specifier,context,next){
 if(specifier.startsWith('projection:/src/'))return {url:new URL('../../projection/src/'+specifier.slice('projection:/src/'.length),import.meta.url).href,shortCircuit:true};
 return next(specifier,context);
}
