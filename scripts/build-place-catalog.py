"""Build an offline US place catalog from the official Census archives (no geocoder calls)."""
import argparse,zipfile,csv,io,json,re,pathlib,hashlib
p=argparse.ArgumentParser();p.add_argument('--source',default='data/reference-sources');p.add_argument('--output',default='public/places');args=p.parse_args();places=[];inputs=[]
for required in ['2026_Gaz_place_national.zip','2026_Gaz_cousubs_national.zip','US.zip']:
 if not (pathlib.Path(args.source)/required).is_file():p.error('Missing '+required+'; run npm run places:download first.')
for file in sorted(pathlib.Path(args.source).glob('*.zip')):
 kind='place' if '_place_' in file.name else 'subdivision' if '_cousubs_' in file.name else 'postal' if '_zcta_' in file.name else None
 if not kind:continue
 with zipfile.ZipFile(file) as z:
  body=z.read(next(n for n in z.namelist() if n.endswith('.txt'))).decode('utf-8-sig');delimiter='|' if '|' in body.splitlines()[0] else '\t'
  for row in csv.DictReader(io.StringIO(body),delimiter=delimiter):
   r={k.strip():v.strip() for k,v in row.items()};raw=r.get('NAME',r['GEOID']);city=re.sub(r' (?:city and borough|city|town|village|borough|CDP|municipality|charter township|township)(?: \(balance\))?$','',raw,flags=re.I)
   if kind=='postal':continue # ZCTA candidates are added by state-qualified place review, never inferred as a city.
   aliases={raw}
   if raw.endswith(' charter township'):aliases.add(raw.replace(' charter township',' Township'))
   places.append({'id':f'census:{kind}:{r["GEOID"]}','city':city,'state':r['USPS'],'country':'US','lat':float(r['INTPTLAT']),'lon':float(r['INTPTLONG']),'kind':kind,'aliases':sorted(aliases-{city})})
 inputs.append({'file':file.name,'sha256':hashlib.sha256(file.read_bytes()).hexdigest(),'sourceUrl':'https://www2.census.gov/geo/docs/maps-data/data/gazetteer/2026_Gazetteer/'+file.name,'license':'US Government public domain'})
# Reviewed spelling/abbreviation aliases identify a Census entity, not a car's physical position.
aliases=[('TX','Fort Worth','Ft Worth'),('TX','New Braunfels','New Braundfels'),('OH','Columbus','Colombus'),('PA','Pittsburgh','Pittsbirgh'),('MN','St. Paul','SaintPaul'),('MO','St. Louis','Saint Louis')]
for state,city,alias in aliases:
 candidates=[x for x in places if x['state']==state and x['city']==city and x['kind']=='place']
 if len(candidates)==1:candidates[0]['aliases'].append(alias)
postal=pathlib.Path(args.source)/'US.zip'
if postal.exists():
 with zipfile.ZipFile(postal) as z:
  records={}
  for line in z.read('US.txt').decode('utf-8').splitlines():
   f=line.split('\t')
   if len(f)<12 or not re.fullmatch('[A-Z]{2}',f[4]):continue
   if f[1] not in records:records[f[1]]={'id':'postal:US:'+f[1],'city':f[2],'state':f[4],'country':'US','lat':float(f[9]),'lon':float(f[10]),'kind':'postal','aliases':[f[1]]}
  places.extend(records.values())
 inputs.append({'file':'US.zip','sha256':hashlib.sha256(postal.read_bytes()).hexdigest(),'sourceUrl':'https://download.geonames.org/export/zip/US.zip','license':'CC-BY-4.0','attribution':'GeoNames — https://www.geonames.org/'})
out=pathlib.Path(args.output);out.mkdir(parents=True,exist_ok=True)
states={};zips={}
for place in places:
 states.setdefault(place['state'],[]).append(place)
 if place['kind']=='postal':
  for alias in place['aliases']:
   if re.fullmatch(r'\d{5}',alias):zips[alias]=place['state']
for state,rows in states.items():(out/(state+'.json')).write_text(json.dumps({'places':rows},separators=(',',':'))+'\n')
(out/'zip-index.json').write_text(json.dumps(zips,separators=(',',':'))+'\n')
(out/'manifest.json').write_text(json.dumps({'version':1,'states':sorted(states),'inputs':inputs,'reviewedAliases':[{'state':state,'canonicalCity':city,'rawAlias':alias,'reviewedOn':'2026-10-21','basis':'State-constrained canonical Census place; spelling or abbreviation normalization only.'} for state,city,alias in aliases],'attribution':'US place reference: Census Bureau. Postal-code estimates: GeoNames (CC BY 4.0), https://www.geonames.org/; postal points may be approximate.','sourceUrl':'https://www.census.gov/geographies/reference-files/time-series/geo/gazetteer-files.2026.html'},indent=2)+'\n')
print(json.dumps({'places':len(places),'stateFiles':len(states),'zipCodes':len(zips),'output':str(out)}))
