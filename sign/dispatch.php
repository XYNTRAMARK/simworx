<?php
declare(strict_types=1);
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, private');
header('X-Content-Type-Options: nosniff');
function respond(int $status,array $data):void{http_response_code($status);echo json_encode($data,JSON_UNESCAPED_SLASHES);exit;}
if(($_SERVER['REQUEST_METHOD']??'')!=='POST')respond(405,['error'=>'POST required']);
$raw=file_get_contents('php://input');
if(!is_string($raw)||strlen($raw)>3000)respond(413,['error'=>'Invalid request size']);
$input=json_decode($raw,true);
$token=$input['token']??'';
if(!is_string($token)||!preg_match('/^[0-9a-f]{64}$/',$token))respond(400,['error'=>'Invalid delivery proof']);
$link=$input['signing_link']??'';
if(!is_string($link)||strlen($link)>900)$link='';
if(!function_exists('curl_init'))respond(503,['error'=>'PHP cURL extension unavailable']);
$ch=curl_init('https://euttubfvsrgkeiescsdm.supabase.co/functions/v1/simworx-sign-api');
curl_setopt_array($ch,[CURLOPT_RETURNTRANSFER=>true,CURLOPT_POST=>true,
 CURLOPT_HTTPHEADER=>['Content-Type: application/json'],
 CURLOPT_POSTFIELDS=>json_encode(['action'=>'mail-claim','token'=>$token,'signing_link'=>$link]),
 CURLOPT_CONNECTTIMEOUT=>6,CURLOPT_TIMEOUT=>25]);
$reply=curl_exec($ch);$code=(int)curl_getinfo($ch,CURLINFO_HTTP_CODE);curl_close($ch);
$claim=is_string($reply)?json_decode($reply,true):null;
if($code!==200||!is_array($claim)||empty($claim['kind']))respond(403,['error'=>'Delivery was not authorised']);
$kind=$claim['kind'];
$to=$claim['to']??'';
$cc=$claim['cc']??[];
if(!is_string($to)||!filter_var($to,FILTER_VALIDATE_EMAIL))respond(400,['error'=>'Invalid recipient']);
if(!is_array($cc))$cc=[];
$cleanCc=[];
foreach($cc as $addr){if(is_string($addr)&&filter_var($addr,FILTER_VALIDATE_EMAIL))$cleanCc[]=$addr;}
$subject=(string)($claim['subject']??'Simworx Sign document');
$subject=preg_replace('/[\r\n]/',' ',$subject);
$body=(string)($claim['message']??'Please see the document signing package.');
if(strlen($body)>6000)respond(400,['error'=>'Invalid message size']);
$from='info@sim-worx.com';
$baseHeaders=['From: Simworx Sign <'.$from.'>','Reply-To: '.$from,'MIME-Version: 1.0','X-Mailer: Simworx-Sign'];
if($cleanCc)$baseHeaders[]='Cc: '.implode(', ',$cleanCc);
if($kind==='invitation'){
 $baseHeaders[]='Content-Type: text/plain; charset=UTF-8';
 $sent=@mail($to,$subject,$body,implode("\r\n",$baseHeaders));
 respond($sent?200:502,['sent'=>(bool)$sent,'type'=>'invitation','message'=>$sent?'Accepted by mail transport':'Mail transport rejected invitation']);
}
if($kind!=='completed')respond(400,['error'=>'Unknown delivery type']);
$files=$claim['files']??[];
if(!is_array($files)||count($files)!==3)respond(400,['error'=>'Expected three signed PDFs']);
$boundary='simworx-'.bin2hex(random_bytes(16));
$parts=[];
$parts[]='--'.$boundary."\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: 8bit\r\n\r\n".$body."\r\n";
$bytes=0;
foreach($files as $item){
 $url=$item['url']??'';$filename=$item['filename']??'signed.pdf';
 if(!is_string($url)||strpos($url,'https://euttubfvsrgkeiescsdm.supabase.co/storage/v1/object/sign/')!==0)respond(400,['error'=>'Unexpected file location']);
 if(!is_string($filename)||!preg_match('/^[a-zA-Z0-9._ -]{1,130}\.pdf$/',$filename))respond(400,['error'=>'Unexpected filename']);
 $ch=curl_init($url);
 curl_setopt_array($ch,[CURLOPT_RETURNTRANSFER=>true,CURLOPT_FOLLOWLOCATION=>false,CURLOPT_CONNECTTIMEOUT=>8,CURLOPT_TIMEOUT=>40,CURLOPT_MAXREDIRS=>0]);
 $pdf=curl_exec($ch);$code=(int)curl_getinfo($ch,CURLINFO_HTTP_CODE);curl_close($ch);
 if($code!==200||!is_string($pdf)||strncmp($pdf,'%PDF-',5)!==0)respond(502,['error'=>'Unable to retrieve signed copy']);
 $bytes+=strlen($pdf);if($bytes>17*1024*1024)respond(413,['error'=>'Signed package exceeds email attachment limit']);
 $parts[]='--'.$boundary."\r\nContent-Type: application/pdf; name=\"".$filename."\"\r\nContent-Transfer-Encoding: base64\r\nContent-Disposition: attachment; filename=\"".$filename."\"\r\n\r\n".chunk_split(base64_encode($pdf),76,"\r\n")."\r\n";
}
$parts[]='--'.$boundary."--\r\n";
$baseHeaders[]='Content-Type: multipart/mixed; boundary="'.$boundary.'"';
$sent=@mail($to,$subject,implode('',$parts),implode("\r\n",$baseHeaders),'-f'.$from);
respond($sent?200:502,['sent'=>(bool)$sent,'type'=>'completed','attached'=>count($files),'message'=>$sent?'Accepted by mail transport':'Mail transport rejected signed copies']);
