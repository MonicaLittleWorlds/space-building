// BSP painter ordering for the editor's convex architectural faces.
// Height is normalized to the same scale as x/z before plane comparisons.
const EPS=1e-7;
const sub=(a,b)=>a.map((x,i)=>x-b[i]);
const dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const norm=p=>[p[0],p[1],p[2]/64];
function plane(vertices){const a=norm(vertices[0]);for(let i=1;i<vertices.length-1;i++){const n=cross(sub(norm(vertices[i]),a),sub(norm(vertices[i+1]),a)),len=Math.hypot(...n);if(len>EPS){const normal=n.map(v=>v/len);return {normal,d:dot(normal,a)};}}return null;}
export function splitFace(face,p){
 const ds=face.vertices.map(v=>dot(p.normal,norm(v))-p.d),positive=ds.some(d=>d>EPS),negative=ds.some(d=>d<-EPS);
 if(!positive&&!negative)return {same:face};if(!negative)return {front:face};if(!positive)return {back:face};
 const front=[],back=[];
 for(let i=0;i<ds.length;i++){const j=(i+1)%ds.length,a=face.vertices[i],b=face.vertices[j],d=ds[i],e=ds[j];if(d>=-EPS)front.push(a);if(d<=EPS)back.push(a);if((d>EPS&&e<-EPS)||(d<-EPS&&e>EPS)){const t=d/(d-e),v=a.map((x,k)=>x+(b[k]-x)*t);front.push(v);back.push(v);}}
 return {front:{...face,vertices:front},back:{...face,vertices:back}};
}
export function orderFaces(faces,rotation=0){
 let root=null;
 function insert(node,face){const p=plane(face.vertices);if(!p)return node;if(!node)return {plane:p,same:[face],front:null,back:null};const parts=splitFace(face,node.plane);if(parts.same)node.same.push(face);if(parts.front)node.front=insert(node.front,parts.front);if(parts.back)node.back=insert(node.back,parts.back);return node;}
 for(const face of faces)root=insert(root,face);
 const camera=[[1,1,1],[1,-1,1],[-1,-1,1],[-1,1,1]][rotation%4],out=[];
 function visit(node){if(!node)return;const near=dot(node.plane.normal,camera)>=0?'front':'back',far=near==='front'?'back':'front';visit(node[far]);out.push(...node.same);visit(node[near]);}visit(root);return out;
}
