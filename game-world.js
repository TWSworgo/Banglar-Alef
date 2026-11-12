import * as THREE from "three";

export class RoadWorld {
  constructor(THREE_, scene) {
    this.THREE = THREE_;
    this.scene = scene;
    this.root = new THREE_.Group();
    this.root.name = "banglar-alef-world";
    scene.add(this.root);
    this.roads = [];
    this.intersections = [];
    this.traffic = [];
    this.people = [];
    this.passengers = [];
    this.spawnSeed = 1731;
    this.build();
  }

  mat(color, roughness = .9, metalness = 0) {
    return new this.THREE.MeshStandardMaterial({ color, roughness, metalness });
  }

  build() {
    const T = this.THREE;
    const asphalt = this.mat(0x303532, .97);
    const sidewalk = this.mat(0x8f918a, .92);
    const lane = this.mat(0xe5d9a8, .72);
    const curb = this.mat(0xb5b5aa, .88);
    const grass = this.mat(0x60745f, 1);
    const buildingMats = [0x8d8174,0xa49b8d,0x7e928c,0xb09b83,0x87908a].map(c=>this.mat(c,.9));
    const ground = new T.Mesh(new T.PlaneGeometry(900,900), grass);
    ground.rotation.x=-Math.PI/2; ground.position.y=-.16; this.root.add(ground);

    const xs=[-180,-90,0,90,180], zs=[-240,-120,0,120,240];
    for (const x of xs) this.addRoad({x,z:0,vertical:true,half:7.5,length:660,asphalt,sidewalk,curb,lane});
    for (const z of zs) this.addRoad({x:0,z,vertical:false,half:7.5,length:420,asphalt,sidewalk,curb,lane});

    for (let ix=0; ix<xs.length; ix++) for (let iz=0; iz<zs.length; iz++) {
      this.intersections.push({x:xs[ix],z:zs[iz],phase:(ix+iz)%2});
      this.addIntersection(xs[ix],zs[iz],asphalt,lane);
    }

    for (let ix=0; ix<xs.length-1; ix++) for (let iz=0; iz<zs.length-1; iz++) {
      this.addBuildings((xs[ix]+xs[ix+1])/2,(zs[iz]+zs[iz+1])/2,buildingMats);
    }

    this.addStreetFurniture(xs,zs);
    this.addTraffic(18);
    this.addPeople(26);
  }

  addRoad({x,z,vertical,half,length,asphalt,sidewalk,curb,lane}) {
    const T=this.THREE;
    const w=half*2;
    const road=new T.Mesh(new T.BoxGeometry(vertical?w:length,.10,vertical?length:w),asphalt);
    road.position.set(x,0,z); road.receiveShadow=true; this.root.add(road);
    const sideSpan=vertical?length:w;
    for(const s of [-1,1]){
      const sx=vertical?x+s*(half+1.7):x;
      const sz=vertical?z:z+s*(half+1.7);
      const sw=vertical?3.0:sideSpan, sd=vertical?sideSpan:3.0;
      const foot=new T.Mesh(new T.BoxGeometry(sw,.12,sd),sidewalk);
      foot.position.set(sx,.03,sz); foot.receiveShadow=true; this.root.add(foot);
      const c= new T.Mesh(new T.BoxGeometry(vertical?.22:sideSpan,.18,vertical?sideSpan:.22),curb);
      c.position.set(vertical?x+s*half: x, .09, vertical?z:z+s*half); this.root.add(c);
    }
    for(let p=-Math.floor(sideSpan/2);p<sideSpan/2;p+=9){
      const stripe=new T.Mesh(new T.BoxGeometry(vertical?.14:4.0,.025,vertical?4.0:.14),lane);
      stripe.position.set(vertical?x:p,.065,vertical?p:z); this.root.add(stripe);
    }
    this.roads.push({x,z,vertical,half,length});
  }

  addIntersection(x,z,asphalt,lane) {
    const T=this.THREE;
    const patch=new T.Mesh(new T.BoxGeometry(15.4,.115,15.4),asphalt);
    patch.position.set(x,.005,z); this.root.add(patch);
    for(const d of [-1,1]) {
      for(let i=-1;i<=1;i++) {
        const stripe=new T.Mesh(new T.BoxGeometry(.18,.03,1.1),lane);
        stripe.position.set(x+i*1.6,.07,z+d*5.8); this.root.add(stripe);
        stripe.rotation.y=Math.PI/2;
        const stripe2=stripe.clone(); stripe2.position.set(x+d*5.8,.07,z+i*1.6); stripe2.rotation.y=0; this.root.add(stripe2);
      }
    }
    const pole=this.mat(0x4b504d,.45,.7);
    const red=this.mat(0xb21f1f,.35,.15); red.emissive.setHex(0x220000);
    const green=this.mat(0x1c9b58,.35,.15); green.emissive.setHex(0x082c17);
    for(const [dx,dz] of [[-6,-6],[6,6]]) {
      const p=new T.Mesh(new T.CylinderGeometry(.06,.08,4.5,8),pole);p.position.set(x+dx,2.25,z+dz);this.root.add(p);
      const lamp=new T.Mesh(new T.SphereGeometry(.16,10,8),green);lamp.position.set(x+dx,4.45,z+dz);this.root.add(lamp);
    }
  }

  addBuildings(cx,cz,mats) {
    const T=this.THREE;
    const offsets=[[-27,-24],[-8,-25],[12,-23],[27,-7],[-25,8],[-7,24],[13,25],[27,8]];
    offsets.forEach((o,i)=>{
      const w=10+(i%3)*4, d=10+((i+1)%3)*4, h=8+(i%5)*4;
      const m=mats[i%mats.length];
      const b=new T.Mesh(new T.BoxGeometry(w,h,d),m);
      b.position.set(cx+o[0],h/2,cz+o[1]);b.castShadow=true;b.receiveShadow=true;this.root.add(b);
      for(let y=3;y<h-1;y+=3) for(let x=-w/2+1.5;x<w/2-1;x+=3.2){
        const win=new T.Mesh(new T.BoxGeometry(.8,.9,.035),this.mat(0x607d83,.2,.05));
        win.position.set(b.position.x+x,y,b.position.z-d/2-.02);this.root.add(win);
      }
    });
  }

  addStreetFurniture(xs,zs) {
    const T=this.THREE, pole=this.mat(0x4f5753,.45,.65), light=this.mat(0xffe5a3,.2,0);
    for(const x of xs) for(const z of zs) {
      for(const side of [-1,1]){
        const p=new T.Mesh(new T.CylinderGeometry(.05,.08,5.8,8),pole);
        p.position.set(x+side*10,2.9,z+8);this.root.add(p);
        const l=new T.Mesh(new T.SphereGeometry(.16,10,8),light);l.position.set(x+side*10,5.7,z+8);this.root.add(l);
      }
    }
  }

  addTraffic(count) {
    const T=this.THREE;
    const colors=[0xc9c6b8,0x315d67,0x9c3e32,0xd0a74f,0x5b6064];
    for(let i=0;i<count;i++){
      const g=new T.Group();
      const body=new T.Mesh(new T.BoxGeometry(1.7,.7,3.3),this.mat(colors[i%colors.length],.5,.12));body.position.y=.62;g.add(body);
      const cab=new T.Mesh(new T.BoxGeometry(1.45,.58,1.7),this.mat(0x536c6c,.18,.04));cab.position.set(0,1.08,-.15);g.add(cab);
      const route=i%2===0?"x":"z", dir=i%4<2?1:-1;
      const laneOffset=(i%3-1)*2.2;
      if(route==="x") g.position.set(-190+((i*47)%380),.02,(i%5-2)*120+laneOffset);
      else g.position.set((i%5-2)*90+laneOffset,.02,-250+((i*61)%500));
      g.rotation.y=route==="x"?(dir>0?Math.PI/2:-Math.PI/2):(dir>0?0:Math.PI);
      g.userData={route,dir,speed:7+(i%5)*1.7,turnTimer:0,kind:i%7===0?"bus":"car"};
      this.root.add(g);this.traffic.push(g);
    }
  }

  addPeople(count) {
    const T=this.THREE;
    for(let i=0;i<count;i++){
      const g=new T.Group();
      const body=new T.Mesh(new T.CapsuleGeometry(.22,.7,4,8),this.mat([0x345f4e,0x6b493a,0x4d6174,0x7b6849][i%4],.95));body.position.y=.58;g.add(body);
      const head=new T.Mesh(new T.SphereGeometry(.18,10,8),this.mat(0x9b6f50,.95));head.position.y=1.18;g.add(head);
      const axis=i%2===0?"x":"z", dir=i%3===0?-1:1;
      g.position.set(axis==="x"?((i*29)%360)-180:(i%4-1.5)*180,0,axis==="z"?((i*37)%480)-240:(i%4-1.5)*120);
      g.userData={axis,dir,speed:.9+(i%4)*.25,wait:0};
      this.root.add(g);this.people.push(g);
    }
  }

  update(dt, player) {
    for(const car of this.traffic) this.updateTraffic(car,dt,player);
    for(const p of this.people) this.updatePerson(p,dt,player);
  }

  updateTraffic(car,dt,player) {
    const T=this.THREE,u=car.userData;
    let blocked=false;
    const ahead=this.traffic.find(o=>o!==car && o.userData.route===u.route && o.userData.dir===u.dir &&
      (u.route==="x"?Math.abs(o.position.z-car.position.z)<2.6:Math.abs(o.position.x-car.position.x)<2.6) &&
      (u.route==="x"?((o.position.x-car.position.x)*u.dir>0 && Math.abs(o.position.x-car.position.x)<14):((o.position.z-car.position.z)*u.dir>0 && Math.abs(o.position.z-car.position.z)<14)));
    if(ahead) blocked=true;
    const px=player.position.x, pz=player.position.z;
    if(u.route==="x"){ if(Math.abs(car.position.x-px)<2.5 && Math.abs(car.position.z-pz)<3.4) blocked=true; car.position.x+=u.dir*u.speed*(blocked?.18:1)*dt; }
    else { if(Math.abs(car.position.z-pz)<2.5 && Math.abs(car.position.x-px)<3.4) blocked=true; car.position.z+=u.dir*u.speed*(blocked?.18:1)*dt; }
    if(u.route==="x" && Math.abs(car.position.x)>215) car.position.x=-u.dir*215;
    if(u.route==="z" && Math.abs(car.position.z)>275) car.position.z=-u.dir*275;
  }

  updatePerson(p,dt,player) {
    const T=this.THREE,u=p.userData;
    const d=Math.hypot(p.position.x-player.position.x,p.position.z-player.position.z);
    if(d<5){u.wait=Math.min(1,u.wait+dt);return;}
    u.wait=Math.max(0,u.wait-dt);
    if(u.wait>0)return;
    if(u.axis==="x")p.position.x+=u.dir*u.speed*dt;else p.position.z+=u.dir*u.speed*dt;
    if(Math.abs(p.position.x)>210||Math.abs(p.position.z)>275)u.dir*=-1;
  }

  nearestPassenger(position) {
    let best=null,bd=1e9;
    for(const p of this.passengers){const d=p.position.distanceTo(position);if(d<bd){bd=d;best=p;}}
    return {passenger:best,distance:bd};
  }

  spawnPassengerNear(position) {
    const T=this.THREE;
    const p=new T.Group();
    const ring=new T.Mesh(new T.CylinderGeometry(.7,.7,.05,24),new T.MeshBasicMaterial({color:0x35e99d}));ring.position.y=.04;p.add(ring);
    const body=new T.Mesh(new T.CapsuleGeometry(.23,.7,4,8),this.mat(0x2e7458,.9));body.position.y=.58;p.add(body);
    p.position.set(position.x+2.5,0,position.z-12);p.userData={active:true};this.root.add(p);this.passengers.push(p);return p;
  }
}

export function createDrivingModel(THREE, vehicle) {
  return {
    speed:0, steer:0, yawRate:0, throttle:0,
    maxSpeed:16.5, acceleration:5.5, brake:10.5,
    steerRate:8.5, lateralDamping:6.5, wheelBase:2.35,
    update(dt,input) {
      const target=(input.right?1:0)-(input.left?1:0);
      this.steer=THREE.MathUtils.damp(this.steer,target,this.steerRate,dt);
      if(input.forward)this.speed=Math.min(this.maxSpeed,this.speed+this.acceleration*dt);
      else this.speed=Math.max(0,this.speed-(input.brake?this.brake:2.7)*dt);
      if(input.brake)this.speed=Math.max(0,this.speed-this.brake*.45*dt);
      const speedFactor=Math.min(1,Math.abs(this.speed)/4);
      this.yawRate=-this.steer*(.32+.78*speedFactor)*(this.speed<0?-1:1);
      vehicle.rotation.y+=this.yawRate*dt;
      const forward=new THREE.Vector3(Math.sin(vehicle.rotation.y),0,Math.cos(vehicle.rotation.y));
      vehicle.position.addScaledVector(forward,-this.speed*dt);
      this.throttle=input.forward?1:0;
      return this.speed;
    }
  };
}
