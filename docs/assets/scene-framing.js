import { campaignLayout } from './campaign-backdrop.js?v=shop-20261013-jury3';

// Shared by the photograph placement and live camera. No GPU or THREE import
// is needed to place the first visible product before the renderer downloads.
const dot=(a,b)=>a.reduce((sum,value,i)=>sum+value*b[i],0);
const add=(a,b,scale=1)=>a.map((value,i)=>value+b[i]*scale);
const normal=a=>a.map(value=>value/Math.hypot(...a));
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];

export function staticSceneFrame({width,height,mode='product',campaign=false,reserved=false,pose=0,reveal=1,zoom=1}){
  width=Math.max(1,width);height=Math.max(1,height);
  const direction=normal(mode==='cap'?[.13,.83,1]:mode==='shell'?[.035,.28,1]:campaign?[.10,.28,1]:[.19,.44,1]);
  const right=normal(cross([0,1,0],direction)),up=normal(cross(direction,right));
  const [radius,bottom,top]=mode==='cap'?[40,149.9,173.4]:mode==='shell'?[29,0,170]:mode==='refill'?[29.1,5,170.5]:[40,0,173.4];
  const angle=campaign?.22-pose*.13+(1-reveal)*.10:0,cos=Math.cos(angle),sin=Math.sin(angle);
  const points=[];
  for(const y of [bottom,top])for(let j=0;j<48;j++){
    const a=j*Math.PI/24,x=radius*Math.cos(a),localY=y-85;
    points.push([x*cos-localY*sin,x*sin+localY*cos+(campaign?(1-reveal)*-8:0),radius*Math.sin(a)]);
  }
  const axes=[right,up,direction],limits=axes.map(axis=>{
    const values=points.map(point=>dot(point,axis));return [Math.min(...values),Math.max(...values)];
  });
  let center=[0,0,0];axes.forEach((axis,i)=>{center=add(center,axis,(limits[i][0]+limits[i][1])/2);});
  const tanV=Math.tan(Math.PI/12),tanH=tanV*width/height;
  const region=reserved?campaignLayout(width,height):{minX:0,maxX:1,minY:0,maxY:1};
  const minX=2*region.minX-1,maxX=2*region.maxX-1,minY=1-2*region.maxY,maxY=1-2*region.minY;
  const aimX=(minX+maxX)/2,aimY=(minY+maxY)/2;
  let distance=0;
  for(const point of points){
    const relative=add(point,center,-1),x=dot(relative,right),y=dot(relative,up),depth=dot(relative,direction);
    distance=Math.max(distance,depth+y/(tanV*(y>=0?maxY-aimY:minY-aimY)),depth+x/(tanH*(x>=0?maxX-aimX:minX-aimX)));
  }
  distance=Math.max(100,distance*1.12);
  let aim=add(center,right,-aimX*tanH*distance/zoom);aim=add(aim,up,-aimY*tanV*distance/zoom);
  return {center,distance,zoom,aim,cameraPosition:add(aim,direction,distance/zoom),direction,right,up,tanV,tanH,points};
}

export function projectScenePoint(point,frame,width,height){
  const relative=add(point,frame.cameraPosition,-1),depth=-dot(relative,frame.direction);
  return {x:(dot(relative,frame.right)/(depth*frame.tanH)+1)*width/2,
    y:(1-dot(relative,frame.up)/(depth*frame.tanV))*height/2};
}

export function scenePreviewBox({width,height,mode='product',campaign=false,reserved=false,pose=0}){
  const reference=staticSceneFrame({width:1280,height:1600,mode,campaign});
  const current=staticSceneFrame({width,height,mode,campaign,reserved,pose});
  const center=projectScenePoint(current.center,current,width,height);
  const scale=height/1600*reference.distance/current.distance;
  return {left:center.x,top:center.y,width:1280*scale,height:1600*scale,rotation:campaign?pose*.13*180/Math.PI:0};
}
