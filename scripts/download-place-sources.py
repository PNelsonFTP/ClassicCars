"""Download public geographic reference archives; no inventory sites or geocoder calls."""
import argparse,pathlib,urllib.request,hashlib,json,zipfile
p=argparse.ArgumentParser();p.add_argument('--output',default='data/reference-sources');p.add_argument('--refresh',action='store_true');a=p.parse_args();folder=pathlib.Path(a.output);folder.mkdir(parents=True,exist_ok=True)
urls={
 '2026_Gaz_place_national.zip':'https://www2.census.gov/geo/docs/maps-data/data/gazetteer/2026_Gazetteer/2026_Gaz_place_national.zip',
 '2026_Gaz_cousubs_national.zip':'https://www2.census.gov/geo/docs/maps-data/data/gazetteer/2026_Gazetteer/2026_Gaz_cousubs_national.zip',
 'US.zip':'https://download.geonames.org/export/zip/US.zip'}
for name,url in urls.items():
 file=folder/name
 if not file.exists() or a.refresh:
  req=urllib.request.Request(url,headers={'User-Agent':'MuscleScout geographic-reference builder'})
  with urllib.request.urlopen(req,timeout=90) as response:body=response.read(20*1024*1024)
  temp=folder/(name+'.part');temp.write_bytes(body)
  with zipfile.ZipFile(temp) as z:
   if z.testzip():raise ValueError('Invalid archive: '+name)
  temp.replace(file)
 print(json.dumps({'file':str(file),'sourceUrl':url,'sha256':hashlib.sha256(file.read_bytes()).hexdigest()}))
