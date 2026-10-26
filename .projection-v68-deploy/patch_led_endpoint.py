from __future__ import annotations
import ftplib,io,os,re,ssl,hashlib
from urllib.parse import urlsplit
from pathlib import Path

ROOT="/htdocs"
def connect():
    raw=os.environ["FTP_HOST"].strip();p=urlsplit(raw if "://" in raw else "ftp://"+raw)
    f=ftplib.FTP_TLS(context=ssl.create_default_context(),timeout=45)
    f.connect(p.hostname,p.port or 21);f.login(os.environ["FTP_USERNAME"],os.environ["FTP_PASSWORD"]);f.prot_p()
    return f
def read(f,path):
    parts=[];f.retrbinary("RETR "+path,parts.append);return b"".join(parts)
def sha(b):return hashlib.sha256(b).hexdigest()

branch=r'''
        if($action==='projection-email'){
            $email=strtolower(trim((string)($_POST['email']??'')));
            if(strlen($email)>254||!filter_var($email,FILTER_VALIDATE_EMAIL))throw new InvalidArgumentException('Enter a valid recipient email address.');
            $reference=trim((string)($_POST['proposal_reference']??''));
            if(!preg_match('/^[A-Za-z0-9._-]{3,90}$/D',$reference))throw new InvalidArgumentException('The proposal reference could not be confirmed.');
            $html=(string)($_POST['proposal_html']??'');
            $plain=(string)($_POST['proposal_text']??'');
            if(strlen($html)<200||strlen($html)>750000||strlen($plain)<100||strlen($plain)>70000)throw new InvalidArgumentException('The proposal document could not be confirmed.');
            if(!str_contains($html,'Simworx Projection System Proposal')||!str_contains($html,'System specification')||!str_contains($html,'Commercial proposal'))throw new InvalidArgumentException('The proposal document is incomplete.');

            $images=[];$rawImages=(string)($_POST['projection_images']??'[]');
            if(strlen($rawImages)>700000)throw new InvalidArgumentException('The configuration images are too large. Please try again.');
            $submitted=json_decode($rawImages,true);
            if(!is_array($submitted)||count($submitted)>4)throw new InvalidArgumentException('The configuration images could not be read.');
            foreach($submitted as $index=>$image){
                if(!is_array($image)||!is_string($image['data']??null)||!preg_match('#^data:image/jpeg;base64,([A-Za-z0-9+/=]+)$#D',$image['data'],$match))throw new InvalidArgumentException('The configuration images could not be read.');
                $bytes=base64_decode($match[1],true);$size=$bytes===false?false:@getimagesizefromstring($bytes);
                if(!$size||$size[2]!==IMAGETYPE_JPEG||$size[0]>800||$size[1]>600||strlen($bytes)>250000)throw new InvalidArgumentException('The configuration images could not be read.');
                $images[]=[
                    'data'=>$image['data'],
                    'bytes'=>$bytes,
                    'cid'=>'projection-view-'.($index+1).'@sim-worx.com'
                ];
            }

            $name=trim((string)($_POST['name']??''));
            $greeting=$name!==''?'<p>Hello '.htmlspecialchars($name,ENT_QUOTES|ENT_SUBSTITUTE,'UTF-8').',</p>':'';
            $quote=[
                'action'=>'email',
                'email'=>$email,
                'reference'=>$reference,
                'created'=>gmdate('Y-m-d'),
                'html'=>$greeting.$html,
                'plain'=>$plain,
                'images'=>$images,
                'total'=>0,
                'currency'=>'EUR'
            ];
            $result=SimworxLedQuoteActions::deliver(
                $quote,
                $_POST,
                static fn(string $to,string $subject,string $body,string $headers):bool=>@mail($to,$subject,$body,$headers),
                static function(array $quote,array $post):void{}
            );
            $result['message']='Your projection proposal email has been sent.';
            $reply(200,$result);
        }
'''

def main():
    with connect() as f:
        path=ROOT+"/led-quote-submit.php"
        original=read(f,path)
        text=original.decode("utf-8","replace")
        if "if($action==='projection-email')" in text:
            print("Projection email branch already present")
            f.quit();return
        anchor="""        if($profileAction){"""
        if anchor not in text: raise RuntimeError("LED handler insertion anchor missing")
        text=text.replace(anchor,branch+"\n"+anchor,1)
        data=text.encode()
        Path("led-quote-submit-patched.php").write_bytes(data)
        staged=ROOT+"/.v68-led-quote-submit.php"
        try:f.delete(staged)
        except Exception:pass
        f.storbinary("STOR "+staged,io.BytesIO(data))
        if sha(read(f,staged))!=sha(data):raise RuntimeError("LED endpoint staged checksum mismatch")
        f.rename(staged,path)
        if sha(read(f,path))!=sha(data):raise RuntimeError("LED endpoint live checksum mismatch")
        f.quit()
    print("Patched live LED endpoint with isolated projection-email branch")
if __name__=="__main__":main()
