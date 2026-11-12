import * as THREE from "three";

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const lerp=(a,b,t)=>a+(b-a)*t;
const dist2=(a,b)=>{const x=a.x-b.x,z=a.z-b.z;return x*x+z*z};

export class RoadWorld{
  constructor(T,scene){
    this.T=T;this.scene=scene;this.root=new T.Group();this.root.name="BA_WORLD";
    scene.add(this.root);
    this.roadW=12; this.laneW=3.2;
    this.nodes=[];this.edges=[];this.traffic=[];this.people=[];this.passengers=[];
    this.lights=[];this.buildings=[];
    this.playerLast={x:0,z:0};
    this.build();
  }
  mat(c,r=.85,m=0){return new this.T.MeshStandardMaterial({color:c,roughness:r,metalness:m})}
  build(){
    const T=this.T;
    const grass=this.mat(0x5d735d,1), asphalt=this.mat(0x292d2c,.96), curb=this.mat(0xa7aaa1,.9), walk=this.mat(0x858982,.95), mark=this.mat(0xe7dcae,.7);
    const g=new T.Mesh(new T.PlaneGeometry(1100,1100),grass);g.rotation.x=-Math.PI/2;g.position.y=-.12;g.receiveShadow=true;this.root.add(g);
    const xs=[-240,-160,-80,0,80,160,240], zs=[-300,-200,-100,0,100,200,300];
    for(const x of xs)this.addRoad(x,0,true,680,asphalt,curb,walk,mark);
    for(const z of zs)this.addRoad(0,z,false,520,asphalt,curb,walk,mark);
    for(let ix=0;ix<xs.length;ix++)for(let iz=0;iz<zs.length;iz++)this.addNode(ix,iz,xs[ix],zs[iz]);
    for(let ix=0;ix<xs.length;ix++)for(let iz=0;iz<zs.length;iz++){if(ix<xs.length-1)this.addEdge(ix,iz,ix+1,iz);if(iz<zs.length-1)this.addEdge(ix,iz,ix,iz+1);}
    this.buildBlocks(xs,zs);this.buildSignals(xs,zs);this.spawnTraffic(42);this.spawnPeople(70);
  }
  addRoad(x,z,vertical,length,asphalt,curb,walk,mark){
    const T=this.T,half=this.roadW/2;
    const road=new T.Mesh(new T.BoxGeometry(vertical?this.roadW:length,.12,vertical?length:this.roadW),asphalt);
    road.position.set(x,0,z);road.receiveShadow=true;this.root.add(road);
    for(const s of[-1,1]){
      const sx=vertical?x+s*(half+1.8):x, sz=vertical?z:z+s*(half+1.8);
      const sw=vertical?3.2:length,sd=vertical?length:3.2;
      const p=new T.Mesh(new T.BoxGeometry(sw,.13,sd),walk);p.position.set(sx,.03,sz);p.receiveShadow=true;this.root.add(p);
      const c=new T.Mesh(new T.BoxGeometry(vertical?.24:length,.18,vertical?length:.24),curb);c.position.set(vertical?x+s*half:x,.1,vertical?z:z+s*half);this.root.add(c);
    }
    const span=vertical?length:Math.abs(length);
    for(let q=-span/2;q<span/2;q+=8){
      const stripe=new T.Mesh(new T.BoxGeometry(vertical?.13:4,.025,vertical?4:.13),mark);
      stripe.position.set(vertical?x:q,.07,vertical?q:z);this.root.add(stripe);
    }
  }
  addNode(ix,iz,x,z){
    const id=this.nodes.length;this.nodes.push({id,ix,iz,x,z,links:[],signal:0});
    const p=new this.T.Mesh(new this.T.BoxGeometry(this.roadW+.4,.1,this.roadW+.4),this.mat(0x2b2e2d,.98));p.position.set(x,.02,z);this.root.add(p);
  }
  addEdge(ax,az,bx,bz){
    const a=this.nodes[az*7+ax],b=this.nodes[bz*7+bx];const len=Math.hypot(a.x-b.x,a.z-b.z);
    const e={a,b,len,axis:a.x===b.x?"z":"x"};this.edges.push(e);a.links.push({edge:e,to:b});b.links.push({edge:e,to:a});
  }
  buildBlocks(xs,zs){
    const T=this.T, mats=[this.mat(0x8d8174),this.mat(0xa89b88),this.mat(0x778b83),this.mat(0xb09a80),this.mat(0x89908b)];
    for(let ix=0;ix<xs.length-1;ix++)for(let iz=0;iz<zs.length-1;iz++){
      const cx=(xs[ix]+xs[ix+1])/2,cz=(zs[iz]+zs[iz+1])/2;
      for(let k=0;k<4;k++){
        const w=13+(k%2)*6,d=13+((k+1)%2)*7,h=8+(k%5)*3;
        const sx=cx+(k%2?23:-23),sz=cz+(k>1?22:-22);
        const b=new T.Mesh(new T.BoxGeometry(w,h,d),mats[(ix+iz+k)%mats.length]);b.position.set(sx,h/2,sz);b.castShadow=true;b.receiveShadow=true;this.root.add(b);
        this.buildings.push(b);
      }
    }
  }
  buildSignals(xs,zs){
    const T=this.T,pole=this.mat(0x4b514d,.45,.65),red=this.mat(0xb51d1d,.3,.1),green=this.mat(0x1eaa62,.3,.1),amber=this.mat(0xe0a52d,.3,.1);
    for(const n of this.nodes){
      const arm=new T.Mesh(new T.CylinderGeometry(.06,.08,4.8,8),pole);arm.position.set(n.x+7,2.4,n.z+7);this.root.add(arm);
      const lamps=[];
      for(let i=0;i<3;i++){const m=[red,amber,green][i];const l=new T.Mesh(new T.SphereGeometry(.15,10,8),m);l.position.set(n.x+7,4.15+i*.38,n.z+7);this.root.add(l);lamps.push(l)}
      this.lights.push({node:n,lamps,phase:(n.ix+n.iz)%2});
    }
  }
  edgePoint(edge,t,lane){
    const a=edge.a,b=edge.b;const x=lerp(a.x,b.x,t),z=lerp(a.z,b.z,t);
    if(edge.axis==="x")z+=lane*this.laneW;else x+=lane*this.laneW;
    return {x,z};
  }
  chooseNext(node,from){
    const options=node.links.filter(v=>v.to!==from);if(!options.length)return null;
    return options[Math.floor(Math.random()*options.length)].edge;
  }
  spawnTraffic(count){
    const T=this.T,cols=[0xc7c2b6,0x3f6670,0x9d4037,0xd0a84c,0x5d6265,0x2e6c55];
    for(let i=0;i<count;i++){
      const edge=this.edges[i%this.edges.length], forward=i%2===0, lane=forward?-.5:.5;
      const g=new T.Group();const body=new T.Mesh(new T.BoxGeometry(1.75,.7,3.45),this.mat(cols[i%cols.length],.5,.12));body.position.y=.58;g.add(body);
      const cab=new T.Mesh(new T.BoxGeometry(1.42,.58,1.65),this.mat(0x536b6d,.2,.05));cab.position.set(0,1.02,-.25);g.add(cab);
      g.userData={edge,from:forward?edge.a:edge.b,to:forward?edge.b:edge.a,t:(i*.137)%1,lane,speed:7+(i%7)*1.1,targetSpeed:8+(i%6)*1.3,accel:3.8,brake:8,wait:0};
      this.root.add(g);this.traffic.push(g);this.placeTraffic(g);
    }
  }
  placeTraffic(v){
    const u=v.userData,p=this.edgePoint(u.edge,u.t,u.lane);v.position.set(p.x,.03,p.z);
    const a=u.from,b=u.to;v.rotation.y=Math.atan2(b.x-a.x,b.z-a.z);
  }
  updateTraffic(dt,player){
    const sorted=[...this.traffic];
    for(const car of sorted){
      const u=car.userData;
      const lead=this.traffic.reduce((best,o)=>{
        if(o===car)return best;const q=o.userData;
        if(q.edge!==u.edge||q.lane!==u.lane)return best;
        const delta=(q.t-u.t)*(u.to===u.edge.b?1:-1);
        return delta>.0&&delta<.08&&(!best||delta<best.delta)?{o,delta}:best;
      },null);
      let desired=u.targetSpeed;
      if(lead){desired=Math.min(desired,Math.max(0,lead.delta*u.edge.len-4)*1.8);}
      const atEnd=u.t>.985;
      if(atEnd && u.to.signal!==undefined && !this.signalGreen(u.to,car))desired=0;
      const dv=desired-u.speed;u.speed+=clamp(dv,-u.brake*dt,u.accel*dt);
      if(u.speed<.2 && desired===0)u.wait+=dt;else u.wait=0;
      u.t+=u.speed*dt/u.edge.len;
      if(u.t>=1){
        const next=this.chooseNext(u.to,u.from);
        if(next){u.from=u.to;u.to=next.a===u.to?next.b:next.a;u.edge=next;u.t=0;}
        else{u.t=0;u.from=u.edge.a;u.to=u.edge.b;}
      }
      this.placeTraffic(car);
      const dx=car.position.x-player.position.x,dz=car.position.z-player.position.z;
      if(dx*dx+dz*dz<16)u.speed=Math.min(u.speed,Math.max(0,Math.abs(u.speed)-3*dt));
    }
    for(const l of this.lights){
      const phase=(performance.now()/1000+l.phase*5)%10;
      const green=phase<6,amberOn=phase>=6&&phase<7.5;
      l.lamps[0].material.emissiveIntensity=green?0.02:1;l.lamps[1].material.emissiveIntensity=amberOn?1:.02;l.lamps[2].material.emissiveIntensity=green?1:.02;
    }
  }
  signalGreen(node,car){const phase=(performance.now()/1000+((node.ix+node.iz)%2)*5)%10;return phase<6}
  spawnPeople(count){
    const T=this.T,mats=[0x345f4e,0x6b493a,0x4d6174,0x7b6849];
    for(let i=0;i<count;i++){const g=new T.Group();const body=new T.Mesh(new T.CapsuleGeometry(.22,.7,4,8),this.mat(mats[i%4],.95));body.position.y=.58;g.add(body);const head=new T.Mesh(new T.SphereGeometry(.18,10,8),this.mat(0x9b6f50,.95));head.position.y=1.18;g.add(head);
      const n=this.nodes[(i*13)%this.nodes.length],side=i%2?1:-1;g.position.set(n.x+side*8,0,n.z+((i%5)-2)*2.2);g.userData={node:n,phase:(i%7)*.6,speed:.8+(i%4)*.2};this.root.add(g);this.people.push(g);}
  }
  updatePeople(dt,player){
    for(const p of this.people){const u=p.userData;if(dist2(p.position,player.position)<36)continue;const a=u.node;const ang=u.phase+performance.now()/7000;p.position.x=a.x+Math.cos(ang)*7;p.position.z=a.z+Math.sin(ang)*7;}
  }
  spawnPassengerNear(player){
    if(this.passengers.length)return this.passengers[0];
    const n=this.nodes[Math.max(0,Math.min(this.nodes.length-1,Math.floor(Math.random()*this.nodes.length)))];
    const T=this.T,g=new T.Group(),ring=new T.Mesh(new T.CylinderGeometry(.8,.8,.05,24),new T.MeshBasicMaterial({color:0x35e99d}));ring.position.y=.03;g.add(ring);
    const body=new T.Mesh(new T.CapsuleGeometry(.23,.7,4,8),this.mat(0x2e7458,.9));body.position.y=.58;g.add(body);g.position.set(n.x+5,0,n.z+3);g.userData.active=true;this.root.add(g);this.passengers.push(g);return g;
  }
  nearestPassenger(pos){let best=null,bd=Infinity;for(const p of this.passengers)if(p.userData.active){const d=Math.sqrt(dist2(p.position,pos));if(d<bd){bd=d;best=p}}return{passenger:best,distance:bd}}
  removePassenger(p){if(!p)return;p.userData.active=false;p.visible=false;}
  nearestNode(pos){return this.nodes.reduce((b,n)=>dist2(n,pos)<dist2(b,pos)?n:b,this.nodes[0]);}
  update(dt,player){this.updateTraffic(dt,player);this.updatePeople(dt,player);}
}

export function createDrivingModel(T,vehicle){
  return {
    speed:0,steer:0,gear:"N",maxForward:16.5,maxReverse:5.5,accel:5.8,brake:11,steerRate:7.5,wheelBase:2.35,
    update(dt,input){
      const steerTarget=(input.right?1:0)-(input.left?1:0);this.steer=T.MathUtils.damp(this.steer,steerTarget,this.steerRate,dt);
      const braking=input.brake;
      if(input.reverse&&!input.forward){this.gear="R";if(this.speed>0)this.speed=Math.max(0,this.speed-this.brake*dt);else this.speed=Math.max(-this.maxReverse,this.speed-this.accel*.7*dt);}
      else if(input.forward){this.gear="D";this.speed=Math.min(this.maxForward,this.speed+this.accel*dt);}
      else {this.gear="N";const dec=braking?this.brake:2.0;if(this.speed>0)this.speed=Math.max(0,this.speed-dec*dt);else if(this.speed<0)this.speed=Math.min(0,this.speed+dec*dt);}
      if(braking&&this.speed>0)this.speed=Math.max(0,this.speed-this.brake*.35*dt);
      const sf=Math.min(1,Math.abs(this.speed)/5);const yaw=-this.steer*(.22+.95*sf)*(this.speed<0?-1:1);
      vehicle.rotation.y+=yaw*dt;
      const f=new T.Vector3(Math.sin(vehicle.rotation.y),0,Math.cos(vehicle.rotation.y));vehicle.position.addScaledVector(f,this.speed*dt);
      return this.speed;
    }
  };
}
