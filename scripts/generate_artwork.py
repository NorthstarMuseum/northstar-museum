"""Render original, locally hosted, museum-style exhibit imagery. No external image assets."""
from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageEnhance
import random, math, numpy as np
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]/'public/assets'
OUT=ROOT/'artifacts';OUT.mkdir(parents=True,exist_ok=True)
W,H=760,900
FONT='/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf'
try:font=ImageFont.truetype(FONT,19)
except:font=None
keys=['compass','guardian','crystal','atlas','lantern','frame','moonstone','lens','letter','ash','codex','clock','egg','stars','gate','keeper','mirror','key']
colors=[(186,138,68),(126,153,145),(103,160,176),(175,143,89),(205,148,75),(150,112,92),(148,183,199),(199,152,99),(180,148,103),(138,117,91),(175,126,95),(176,131,67),(192,175,143),(177,142,90),(161,131,95),(180,128,74),(177,182,185),(183,134,64)]

def layered(rng,accent):
 yy,xx=np.mgrid[0:H,0:W].astype('float32');rad=((xx/W-.49)**2+(yy/H-.40)**2)**.5
 glow=np.exp(-(((xx/W-.51)**2)/.2+((yy/H-.37)**2)/.15));tone=np.clip(.15+.22*glow-.16*rad,0,1)
 noise=np.random.default_rng(rng.randint(1,10000000)).normal(0,4,(H,W))
 a=np.empty((H,W,3),dtype='uint8')
 for c in range(3):a[:,:,c]=np.clip((np.array([7,24,28])[c]*(1-tone)+(accent[c]*tone)*.63)+noise,0,255)
 im=Image.fromarray(a,'RGB').convert('RGBA')
 dust=Image.new('RGBA',(W,H));dd=ImageDraw.Draw(dust,'RGBA')
 for i in range(230):
  x=rng.randint(0,W);y=rng.randint(0,H);rr=rng.choice([1,1,1,2]);dd.ellipse((x,y,x+rr,y+rr),fill=(*accent,rng.randint(16,58)))
 im.alpha_composite(dust)
 return im

def shape(im,kind,accent,rng):
 layer=Image.new('RGBA',(W,H));d=ImageDraw.Draw(layer,'RGBA')
 gold=(213,165,89,255);gold2=(121,78,32,255);silver=(155,176,176,255)
 cx,cy=380,448
 def ring(box,width=11,col=gold):d.ellipse(box,outline=col,width=width)
 def ellipse(box,fill,outline=None,width=3):d.ellipse(box,fill=fill,outline=outline,width=width)
 def line(points,fill=gold,width=6):d.line(points,fill=fill,width=width,joint='curve')
 def polygon(points,fill,outline=None,width=2):d.polygon(points,fill=fill);d.line(points+[points[0]],fill=outline or gold,width=width,joint='curve')
 if kind in ('compass','stars','clock','lens'):
  for r in [243,221,176,157,120]:ring((cx-r,cy-r,cx+r,cy+r),max(4,int(r/32)),gold if r%2 else gold2)
  for i in range(24):
   t=i*math.pi/12
   line([(cx+210*math.cos(t),cy+210*math.sin(t)),(cx+(232 if i%3==0 else 221)*math.cos(t),cy+(232 if i%3==0 else 221)*math.sin(t))],gold,3)
  if kind=='stars':
   for i in range(7):
    t=i*2*math.pi/7; x=cx+105*math.cos(t);y=cy+105*math.sin(t)
    ellipse((x-8,y-8,x+8,y+8),(245,212,151,255));line([(cx,cy),(x,y)],(197,152,85,130),2)
  elif kind=='clock':
   line([(cx,cy),(cx-43,cy-96)],gold,9);line([(cx,cy),(cx+86,cy+31)],gold,7)
   for i in range(12):
    t=i*math.pi/6; x=cx+186*math.cos(t);y=cy+186*math.sin(t);d.text((x-8,y-9),str(i+1),font=font,fill=gold)
  elif kind=='lens':
   ellipse((cx-101,cy-101,cx+101,cy+101),(41,97,114,180),gold,8)
   for i in range(7):line([(cx-68+i*21,cy-75),(cx+50+i*8,cy+90)],(173,226,238,65),3)
  else:
   polygon([(cx,cy-170),(cx+40,cy),(cx,cy+176),(cx-40,cy)],(201,157,81,255))
   polygon([(cx-175,cy),(cx,cy-40),(cx+175,cy),(cx,cy+40)],(230,187,112,240))
   ellipse((cx-28,cy-28,cx+28,cy+28),(42,85,92,255),gold,7)
 elif kind in ('guardian','gate'):
  if kind=='guardian':
   polygon([(cx-152,cy-225),(cx+152,cy-225),(cx+173,cy-85),(cx+132,cy+126),(cx+63,cy+221),(cx-63,cy+221),(cx-132,cy+126),(cx-173,cy-85)],(86,99,79,255),gold2,8)
   for x in (-1,1):
    polygon([(cx+x*24,cy-60),(cx+x*109,cy-80),(cx+x*126,cy-37),(cx+x*35,cy-20)],(19,34,34,255),gold,4)
    for i in range(5):line([(cx+x*(53+i*15),cy+26),(cx+x*(47+i*12),cy+70)],gold2,3)
   polygon([(cx-32,cy+18),(cx+32,cy+18),(cx,cy+114)],(147,117,74,255),gold,3)
   line([(cx-88,cy-141),(cx+88,cy-141)],gold,13)
  else:
   polygon([(cx-216,cy+300),(cx-216,cy-152),(cx-176,cy-259),(cx+176,cy-259),(cx+216,cy-152),(cx+216,cy+300)],(93,87,78,255),gold2,11)
   polygon([(cx-131,cy+300),(cx-131,cy-128),(cx,cy-198),(cx+131,cy-128),(cx+131,cy+300)],(12,34,43,255),gold,8)
   for i in range(9):line([(cx-216,cy-150+i*49),(cx-131,cy-150+i*49)],gold2,3)
 elif kind in ('crystal','moonstone','egg'):
  if kind=='egg':
   ellipse((cx-152,cy-230,cx+152,cy+254),(206,183,147,255),gold,9)
   ellipse((cx-83,cy-160,cx-12,cy+94),(255,236,204,95))
   line([(cx-91,cy+58),(cx-30,cy+78),(cx+15,cy+48),(cx+88,cy+111)],(107,86,70,210),4)
  elif kind=='moonstone':
   ellipse((cx-205,cy-205,cx+205,cy+205),(70,120,154,255),(180,217,221,255),7)
   for i in range(33):
    x=rng.randint(cx-170,cx+170);y=rng.randint(cy-170,cy+170)
    if (x-cx)**2+(y-cy)**2<168**2:ellipse((x-7,y-7,x+7,y+7),(194,222,231,rng.randint(80,180)))
  else:
   pts=[(cx,cy-270),(cx+178,cy-89),(cx+111,cy+205),(cx-114,cy+205),(cx-172,cy-90)]
   polygon(pts,(47,153,161,250),(210,224,208,220),7)
   for polygon_pts in [[pts[0],pts[1],(cx,cy+5)],[pts[0],(cx,cy+5),pts[4]],[(cx,cy+5),pts[2],pts[3]],[(cx,cy+5),pts[1],pts[2]]]:polygon(polygon_pts,(rng.randint(42,82),rng.randint(124,192),rng.randint(148,202),rng.randint(155,250)),None,2)
 elif kind in ('lantern','keeper'):
  d.rounded_rectangle((cx-158,cy-205,cx+158,cy+217),radius=32,fill=(26,42,45,255),outline=gold,width=13)
  polygon([(cx-110,cy-138),(cx+110,cy-138),(cx+89,cy+144),(cx-89,cy+144)],(90,141,138,85),gold,5)
  d.ellipse((cx-75,cy-115,cx+75,cy+135),fill=(247,174,73,108))
  ellipse((cx-27,cy-35,cx+27,cy+87),(250,205,126,210))
  for x in [-95,95]:line([(cx+x,cy-155),(cx+x,cy+186)],gold,12)
  d.rounded_rectangle((cx-200,cy+189,cx+200,cy+228),radius=14,fill=gold2,outline=gold,width=6)
  d.arc((cx-54,cy-286,cx+54,cy-145),180,360,fill=gold,width=12)
 elif kind in ('frame','mirror'):
  for i in range(4):
   b=(cx-204-i*8,cy-255-i*8,cx+204+i*8,cy+255+i*8)
   if kind=='mirror':ring(b,8,gold if i%2 else gold2)
   else:d.rounded_rectangle(b,radius=8,outline=gold if i%2 else gold2,width=8)
  if kind=='frame':
   polygon([(cx-40,cy-74),(cx+37,cy-74),(cx+79,cy+133),(cx-93,cy+133)],(103,87,76,255),gold2,3)
   ellipse((cx-64,cy-160,cx+57,cy+9),(145,124,102,255))
   ellipse((cx-39,cy-90,cx-5,cy-63),(60,55,48,255))
  else:ellipse((cx-172,cy-221,cx+172,cy+221),(61,115,132,180),silver,7);line([(cx-101,cy-150),(cx+89,cy+157)],(215,223,220,100),11)
 elif kind in ('atlas','letter','ash','codex'):
  if kind=='codex':
   polygon([(cx-201,cy-200),(cx+190,cy-175),(cx+190,cy+244),(cx-201,cy+225)],(122,78,63,255),gold,13)
   for i in range(10):line([(cx-189+i,cy+229+i/2),(cx+177,cy+249-i/2)],(235,212,173,210),2)
   ellipse((cx-40,cy-41,cx+40,cy+39),(50,71,72,255),gold,7)
  else:
   polygon([(cx-206,cy-265),(cx+205,cy-252),(cx+185,cy+266),(cx-209,cy+249)],(196,171,123,255),gold2,6)
   for i in range(15):
    y=cy-200+i*29;line([(cx-151,y),(cx+112+rng.randint(-20,45),y+rng.randint(-7,7))],(115,84,55,130),3)
   if kind=='letter':
    ellipse((cx-47,cy+60,cx+47,cy+154),(120,52,47,255),gold,8);d.text((cx-14,cy+84),'N',fill=gold,font=font)
   elif kind=='atlas':
    for i in range(6):d.arc((cx-140,cy-200,cx+155,cy+150),i*36,i*36+67,fill=(53,103,101,210),width=6)
   else:
    for i in range(10):
     x=rng.randint(cx-202,cx+175);y=rng.choice([rng.randint(cy-265,cy-190),rng.randint(cy+200,cy+263)])
     ellipse((x-24,y-22,x+24,y+22),(23,24,22,160))
 elif kind=='key':
  ring((cx-158,cy-243,cx+26,cy-59),25,gold)
  line([(cx-63,cy-59),(cx+99,cy+225)],gold,34);line([(cx+82,cy+170),(cx+158,cy+130)],gold,25);line([(cx+102,cy+206),(cx+174,cy+167)],gold,22)
  ring((cx-109,cy-196,cx-24,cy-109),10,gold2)
 # Drop-shadow and soft reflected glow
 shadow=Image.new('RGBA',(W,H));sh=ImageDraw.Draw(shadow,'RGBA');sh.ellipse((115,695,645,746),fill=(0,0,0,190));shadow=shadow.filter(ImageFilter.GaussianBlur(34));im.alpha_composite(shadow)
 glow=layer.filter(ImageFilter.GaussianBlur(29));glow.putalpha(glow.getchannel('A').point(lambda a:int(a*.13)));im.alpha_composite(glow)
 im.alpha_composite(layer)
 d2=ImageDraw.Draw(im,'RGBA');d2.line([(90,74),(670,74)],fill=(*accent,100),width=2);d2.line([(90,824),(670,824)],fill=(*accent,100),width=2)
 d2.text((95,785),'N O R T H S T A R   /   C O L L E C T I O N',font=font,fill=(220,204,165,200))
 return im

for i,key in enumerate(keys):
 rng=random.Random(1081+i*7919)
 im=layered(rng,colors[i]);im=shape(im,key,colors[i],rng).convert('RGB')
 im.save(OUT/(key+'.webp'),'WEBP',quality=83,method=5)
 print(key,(OUT/(key+'.webp')).stat().st_size)

src=Path('/mnt/data/a_wide_moody_cinematic_website_homepage_screensh.png')
if src.exists():
 source=Image.open(src).convert('RGB')
 # Crop only the artwork inside the generated concept, without text, controls, or logos.
 museum=source.crop((555,84,1120,510)).resize((1230,930),Image.Resampling.LANCZOS)
 museum.save(ROOT/'museum-hero.webp','WEBP',quality=88,method=6)
