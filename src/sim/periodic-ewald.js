/**
 * Deterministic 3-D Ewald reference for the periodic Poisson Green function.
 * Point-particle model; real and reciprocal truncations are explicit.
 */
export const EWALD_SCHEMA = 'vepa.periodic-ewald';
export const EWALD_VERSION = 1;
const finite=(v,n)=>{if(!Number.isFinite(v))throw new RangeError(n+' must be finite');return v;};
const positive=(v,n)=>{finite(v,n);if(v<=0)throw new RangeError(n+' must be positive');return v;};
function kVectors(shell){
  const out=[];
  for(let x=-shell;x<=shell;x++)for(let y=-shell;y<=shell;y++)for(let z=-shell;z<=shell;z++){
    if(x===0&&y===0&&z===0)continue;
    if(x<0||(x===0&&y<0)||(x===0&&y===0&&z<0))continue;
    out.push([x,y,z]);
  }
  return out;
}
function sum(values){let s=0,c=0;for(const v of values){const y=v-c,t=s+y;c=(t-s)-y;s=t;}return s;}
function erfc(x){
  // Numerical Recipes rational approximation; deterministic double precision.
  const z=Math.abs(x), t=1/(1+0.5*z);
  const ans=t*Math.exp(-z*z-1.26551223+t*(1.00002368+t*(0.37409196+t*(0.09678418+t*(-0.18628806+t*(0.27886807+t*(-1.13520398+t*(1.48851587+t*(-0.82215223+t*0.17087277)))))))));
  return x>=0?ans:2-ans;
}
function validate(options){
  const {particles,boxSize, coupling=1, alpha=5/boxSize, realShell=1, reciprocalShell=4,
    neutrality='require', neutralityTolerance=1e-10}=options??{};
  if(!Array.isArray(particles))throw new TypeError('particles must be an array');
  positive(boxSize,'boxSize');positive(alpha,'alpha');finite(coupling,'coupling');positive(neutralityTolerance,'neutralityTolerance');
  if(!Number.isInteger(realShell)||realShell<0||realShell>6)throw new RangeError('realShell must be an integer from 0 to 6');
  if(!Number.isInteger(reciprocalShell)||reciprocalShell<1||reciprocalShell>16)throw new RangeError('reciprocalShell must be an integer from 1 to 16');
  if(!['require','uniform-background'].includes(neutrality))throw new RangeError('neutrality must be require or uniform-background');
  const ids=new Set(), total=[];
  for(const p of particles){
    if(!p||typeof p.id!=='string'||!p.id||ids.has(p.id))throw new TypeError('particles require unique stable ids');
    ids.add(p.id);
    if(!Array.isArray(p.position)||p.position.length!==3)throw new TypeError('particle positions must have three components');
    for(let a=0;a<3;a++){finite(p.position[a],'position');if(p.position[a]<0||p.position[a]>=boxSize)throw new RangeError('positions must be wrapped into [0, boxSize)');}
    total.push(finite(p.charge,'particle charge'));
  }
  const netCharge=sum(total);
  const scale=Math.max(1,sum(total.map(Math.abs)));
  if(neutrality==='require'&&Math.abs(netCharge)>neutralityTolerance*scale)throw new RangeError('periodic Ewald system is not neutral within neutralityTolerance');
  return {particles,boxSize,coupling,alpha,realShell,reciprocalShell,neutrality,neutralityTolerance,netCharge};
}

/**
 * Energy and force for U = coupling * sum(q_i q_j G_periodic).
 * Gravity uses q_i=m_i, coupling=-G and uniform-background (mean density removed).
 * Electrostatics uses q_i=charge_i, coupling=k_e and normally requires neutrality.
 */
export function calculateEwaldSystem(options={}){
  const p=validate(options), {particles,boxSize:L,coupling:K,alpha:a,realShell,reciprocalShell}=p;
  const n=particles.length,V=L**3, forces=particles.map(()=>[0,0,0]);
  const realEnergy=[], reciprocalEnergy=[], realVectors=[];
  const rootPi=Math.sqrt(Math.PI), pref=2*a/rootPi;
  for(let i=0;i<n;i++)for(let j=i+1;j<n;j++){
    const pi=particles[i],pj=particles[j], q=pi.charge*pj.charge;
    for(let ix=-realShell;ix<=realShell;ix++)for(let iy=-realShell;iy<=realShell;iy++)for(let iz=-realShell;iz<=realShell;iz++){
      const d=[pi.position[0]-pj.position[0]-ix*L,pi.position[1]-pj.position[1]-iy*L,pi.position[2]-pj.position[2]-iz*L];
      const r2=d[0]**2+d[1]**2+d[2]**2;
      if(r2===0)throw new RangeError('coincident particles are unsupported by point-particle Ewald');
      const r=Math.sqrt(r2), e=Math.exp(-(a*r)**2), c=erfc(a*r);
      realEnergy.push(K*q*c/r);
      const f=K*q*(c/(r2*r)+pref*e/r2);
      for(let axis=0;axis<3;axis++){forces[i][axis]+=f*d[axis];forces[j][axis]-=f*d[axis];}
      realVectors.push(Object.freeze({image:ix+','+iy+','+iz,entityA:pi.id,entityB:pj.id}));
    }
  }
  // Self-image real-space energy; symmetric images give exactly zero net self-force.
  const selfImage=[];
  for(const particle of particles)for(let ix=-realShell;ix<=realShell;ix++)for(let iy=-realShell;iy<=realShell;iy++)for(let iz=-realShell;iz<=realShell;iz++){
    if(ix===0&&iy===0&&iz===0)continue;
    const r=L*Math.hypot(ix,iy,iz);
    selfImage.push(0.5*K*particle.charge**2*erfc(a*r)/r);
  }
  const half=kVectors(reciprocalShell);
  for(const kv of half){
    const k=kv.map(v=>2*Math.PI*v/L), k2=k[0]**2+k[1]**2+k[2]**2;
    const weight=Math.exp(-k2/(4*a*a))/k2;
    const phases=particles.map(x=>k[0]*x.position[0]+k[1]*x.position[1]+k[2]*x.position[2]);
    // Diagonal structure-factor contribution plus distinct-pair cross terms.
    reciprocalEnergy.push(K*(4*Math.PI/V)*weight*sum(particles.map(x=>x.charge*x.charge)));
    for(let i=0;i<n;i++)for(let j=i+1;j<n;j++){
      const q=particles[i].charge*particles[j].charge, phase=phases[i]-phases[j];
      const factor=K*(8*Math.PI/V)*weight*q;
      reciprocalEnergy.push(factor*Math.cos(phase));
      const f=factor*Math.sin(phase);
      for(let axis=0;axis<3;axis++){forces[i][axis]+=f*k[axis];forces[j][axis]-=f*k[axis];}
    }
  }
  const selfEnergy=-K*a/rootPi*sum(particles.map(x=>x.charge*x.charge));
  const backgroundEnergy=p.neutrality==='uniform-background'?-K*Math.PI*p.netCharge**2/(2*a*a*V):0;
  const real=sum(realEnergy)+sum(selfImage), reciprocal=sum(reciprocalEnergy);
  const total=real+reciprocal+selfEnergy+backgroundEnergy;
  if(!Number.isFinite(total)||forces.some(f=>f.some(v=>!Number.isFinite(v))))throw new RangeError('Ewald calculation overflowed');
  return Object.freeze({
    schema:EWALD_SCHEMA,version:EWALD_VERSION,method:'3d-ewald-point-particles',
    boxSize:L,coupling:K,alpha:a,realShell,reciprocalShell,neutrality:p.neutrality,netCharge:p.netCharge,
    forces:Object.freeze(forces.map((force,i)=>Object.freeze({entityId:particles[i].id,force:Object.freeze(force)}))),
    components:Object.freeze({realSpace:real,reciprocalSpace:reciprocal,self:selfEnergy,uniformBackground:backgroundEnergy,total}),
    pairImageCount:realVectors.length,\n    realImageIdentities:Object.freeze(realVectors),\n    reciprocalVectorCount:half.length,\n    reciprocalVectorIdentities:Object.freeze(half.map(v=>Object.freeze({integerVector:Object.freeze(v),waveVector:Object.freeze(v.map(x=>2*Math.PI*x/L))}))),
    truncation:Object.freeze({realShell,reciprocalShell,empiricalOnly:true,errorBound:null}),
    assumptions:Object.freeze([
      'Cubic three-dimensional periodic cell and point particles',
      'Unsoftened 1/r Poisson Green function; no finite-range cutoff',
      'Real and reciprocal sums are symmetrically truncated at declared shell radii',
      'Truncation diagnostics are empirical; no rigorous error bound is claimed',
      p.neutrality==='uniform-background'?'Uniform compensating background removes the k=0 mode':'Net source must be neutral within the declared tolerance',
      'Gravity with coupling -G and positive masses represents mean-density-subtracted periodic Poisson gravity',
    ]),
  });
}

/** Compare independently recomputed truncation levels; differences are not certified bounds. */
export function compareEwaldTruncations(options,{levels=[[1,3],[2,5],[3,7]]}={}){
  if(!Array.isArray(levels)||levels.length<2)throw new RangeError('at least two truncation levels are required');
  const results=levels.map(([realShell,reciprocalShell])=>calculateEwaldSystem({...options,realShell,reciprocalShell}));
  const comparisons=[];
  for(let i=1;i<results.length;i++){
    const a=results[i-1],b=results[i];
    comparisons.push(Object.freeze({from:[a.realShell,a.reciprocalShell],to:[b.realShell,b.reciprocalShell],
      energyDelta:b.components.total-a.components.total,
      forceDeltaMax:Math.max(0,...b.forces.map((x,j)=>Math.hypot(...x.force.map((v,k)=>v-a.forces[j].force[k]))))}));
  }
  return Object.freeze({results:Object.freeze(results),comparisons:Object.freeze(comparisons),errorBound:null,
    interpretation:'Truncation-level differences are empirical diagnostics, not rigorous error bounds'});
}
