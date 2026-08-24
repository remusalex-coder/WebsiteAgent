import { chromium } from 'playwright';
const targets = [
  ['likova','https://likova.space/'],['mosbyfiles','https://www.mosbyfiles.com/'],
  ['revelatio','https://revelatio.studio/'],['vero','https://verostudio.com/'],
  ['produx','https://www.produx.design/'],['nothin','https://www.noth.in/'],
  ['k95','https://k95.it/'],['haoqi','https://haoqi.design/']
];
const browser = await chromium.launch({ headless: true });
const page = await browser.newContext({ userAgent:'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36', viewport:{width:1440,height:900} }).then(c=>c.newPage());
const out=[];
for (const [n,u] of targets){
  try{
    await page.goto(u,{waitUntil:'domcontentloaded',timeout:50000});
    await page.waitForTimeout(4000);
    const d = await page.evaluate(()=>{
      const o={};
      o.lenis = document.documentElement.className.includes('lenis') || !!document.querySelector('[data-lenis], .lenis');
      o.globals = ['gsap','ScrollTrigger','THREE','OGL','Lenis','barba','Swup','LocomotiveScroll'].filter(g=>window[g]!==undefined);
      const c = Array.from(document.querySelectorAll('canvas'));
      o.canvas = c.length; o.webgl = c.some(x=>{try{return !!(x.getContext('webgl')||x.getContext('webgl2'));}catch{return false;}});
      const fonts=new Set();
      document.querySelectorAll('body *').forEach(el=>{const f=getComputedStyle(el).fontFamily; if(f)f.split(',').forEach(x=>fonts.add(x.trim().replace(/["']/g,'')));});
      const sys=['Times New Roman','Inter Tight','Roboto','Helvetica Neue','Arial','sans-serif','serif','system-ui','-apple-system','Segoe UI','Noto Sans','Apple Color Emoji','Inter'];
      o.customFonts=Array.from(fonts).filter(f=>!sys.includes(f)).slice(0,6);
      const h1=document.querySelector('h1');
      o.h1Size = h1?getComputedStyle(h1).fontSize:null;
      o.h1Transform = h1?getComputedStyle(h1).textTransform:null;
      const hero=document.querySelector('section,header,main')||document.body;
      const v=hero.querySelector('video');
      o.heroVideo=!!v;
      o.bodyBg=getComputedStyle(document.body).backgroundColor;
      return o;
    });
    out.push({n,u,status:'ok',...d});
  }catch(e){ out.push({n,u,status:'err',error:e.message.split('\n')[0]}); }
}
console.log(JSON.stringify(out,null,2));
await browser.close();
