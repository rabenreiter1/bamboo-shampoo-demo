/** Public presentation names are independent of historical rendering IDs. */
export const PRESENTATIONS=Object.freeze({
 modern:Object.freeze({name:'Modern',style:'classic',prefix:'',bookmarkKey:'bamboo-journey-return-v1:classic',bookmarkLayout:'modern-scroll-guide-v2'}),
 classic:Object.freeze({name:'Classic',style:'current',prefix:'/design/classic',bookmarkKey:'bamboo-journey-return-v1',bookmarkLayout:'sage-autoplay-guide-v2'}),
});
export function presentationRouteBase(base,presentation='modern'){
 return base.replace(/\/$/,'')+(PRESENTATIONS[presentation]||PRESENTATIONS.modern).prefix;
}
export function localizedPresentationSuffix(href,base){
 const url=new URL(href),root=base.replace(/\/$/,'');
 if(!url.pathname.startsWith(root+'/'))return null;
 const suffix=url.pathname.slice(root.length).replace(/^\/(?:design\/classic|classic)(?=\/)/,'');
 return /^\/(de|en)\//.test(suffix)?suffix:null;
}
