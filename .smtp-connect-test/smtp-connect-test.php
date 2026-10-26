<?php
header('Content-Type: application/json');
header('Cache-Control: no-store');
$result=['openssl'=>extension_loaded('openssl'),'tests'=>[]];
foreach([
  ['host'=>'ssl://smtp.livemail.co.uk','port'=>465],
  ['host'=>'smtp.livemail.co.uk','port'=>587]
] as $t){
  $errno=0;$errstr='';
  $fp=@stream_socket_client($t['host'].':'.$t['port'],$errno,$errstr,8,STREAM_CLIENT_CONNECT);
  if(!$fp){
    $result['tests'][]=['port'=>$t['port'],'connected'=>false,'errno'=>$errno,'error'=>$errstr];
    continue;
  }
  stream_set_timeout($fp,4);
  $banner=@fgets($fp,512);
  @fwrite($fp,"EHLO sim-worx.com\r\n");
  $lines=[];
  while(($line=@fgets($fp,512))!==false){
    $lines[]=trim($line);
    if(strlen($line)<4 || $line[3]!=='-')break;
    if(count($lines)>20)break;
  }
  @fwrite($fp,"QUIT\r\n");
  fclose($fp);
  $result['tests'][]=['port'=>$t['port'],'connected'=>true,'banner'=>trim((string)$banner),'ehlo'=>$lines];
}
echo json_encode($result,JSON_UNESCAPED_SLASHES);
