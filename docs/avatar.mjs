// Original LittleWorlds builder avatar. Dimensions are in unzoomed scene pixels.
export const AVATAR_HEIGHT=178;
export function avatarPose(direction,phase=0,moving=false){
 const length=Math.hypot(direction.x,direction.y)||1,dx=direction.x/length,dy=direction.y/length;
 const stride=moving?Math.sin(phase)*13:0,bob=moving?Math.abs(Math.sin(phase))*2:0;
 return {dx,dy,stride,bob,back:dy<-.15,profile:Math.abs(dx)>.75};
}
export function drawBuilderAvatar(add,direction,phase,moving){
 const p=avatarPose(direction,phase,moving),skin='#d6a27b',darkSkin='#b88060',shirt='#65bba9',outline='#294747';
 const ellipse=(cx,cy,rx,ry,fill)=>add('ellipse',{cx,cy,rx,ry,fill});
 const line=(x1,y1,x2,y2,stroke,width)=>add('line',{x1,y1,x2,y2,stroke,'stroke-width':width,'stroke-linecap':'round'});
 const limb=(side,far)=>{
  const swing=p.stride*side,hip=side*10,footX=hip+p.dx*swing,footY=-7+p.dy*swing*.45-Math.max(0,swing)*.35;
  line(hip,-66-p.bob,hip+p.dx*swing*.45,-36,far?'#344951':'#425e66',15);
  line(hip+p.dx*swing*.45,-36,footX,footY,far?'#344951':'#425e66',13);
  ellipse(footX+p.dx*3,footY+2,11,6,'#263536');
 };
 const arm=(side,far)=>{const swing=-p.stride*side,shoulder=side*(p.profile?15:22),hand=shoulder+p.dx*swing;
  line(shoulder,-112-p.bob,shoulder+p.dx*swing*.35,-87-p.bob,far?'#4a9b8d':shirt,15);
  line(shoulder+p.dx*swing*.35,-87-p.bob,hand,-67-p.bob+p.dy*swing*.35,far?darkSkin:skin,11);
  ellipse(hand,-66-p.bob+p.dy*swing*.35,6,7,far?darkSkin:skin);
 };
 ellipse(0,0,24,10,'#28413b');
 limb(-1,true);arm(-1,true);limb(1,false);
 add('path',{d:`M -18 ${-120-p.bob} Q 0 ${-129-p.bob} 18 ${-120-p.bob} L 20 -66 Q 0 -59 -20 -66 Z`,fill:shirt,stroke:outline,'stroke-width':1.5});
 if(!p.back){line(-9,-117-p.bob,0,-111-p.bob,'#d3ede0',3);line(0,-111-p.bob,9,-117-p.bob,'#d3ede0',3);}
 arm(1,false);line(0,-121-p.bob,0,-131-p.bob,skin,15);
 ellipse(0,-146-p.bob,p.profile?24:29,29,skin);
 ellipse(p.dx>0?-24:24,-145-p.bob,5,8,darkSkin);
 add('path',{d:`M -27 ${-147-p.bob} Q -32 ${-178-p.bob} 0 ${-177-p.bob} Q 32 ${-177-p.bob} 27 ${-146-p.bob} L 19 ${-158-p.bob} Q 0 ${-153-p.bob} -19 ${-160-p.bob} Z`,fill:'#4b3c35'});
 if(p.back){ellipse(0,-151-p.bob,p.profile?23:27,23,'#4b3c35');}
 else{const shift=p.dx*8;for(const eye of p.profile?[p.dx>0?10:-10]:[-10,10]){ellipse(eye+shift,-146-p.bob,3,4,'#283c3b');ellipse(eye+shift+.7,-147-p.bob,.9,1,'#f8f5e9');}line(shift-4,-132-p.bob,shift+4,-132-p.bob,'#955f4b',2);}
}
