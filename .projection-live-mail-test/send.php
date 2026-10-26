<?php
declare(strict_types=1);
header('Content-Type: application/json; charset=utf-8');
$_SERVER['REQUEST_METHOD']='GET';
ob_start();
require __DIR__.'/led-quote-submit.php';
ob_end_clean();
if(!class_exists('SimworxLedQuoteActions')){
    http_response_code(500);
    echo json_encode(['ok'=>false,'message'=>'LED delivery class unavailable']);
    exit;
}
$reference='SWX-PROJ-LIVE-EMAIL-TEST-'.gmdate('Ymd-His');
$quote=[
  'action'=>'email',
  'email'=>'mark@sim-worx.com',
  'reference'=>$reference,
  'created'=>gmdate('Y-m-d'),
  'html'=>'<article><h1>Simworx Projection System Proposal</h1><p><strong>LIVE DELIVERY TEST</strong></p><h2>System specification</h2><p>This is a controlled Projection email-path test using the exact working LED delivery routine.</p><h2>Commercial proposal</h2><p>No commercial value. Test only.</p></article>',
  'plain'=>"SIMWORX PROJECTION SYSTEM PROPOSAL\r\nLIVE DELIVERY TEST\r\nReference: $reference\r\n\r\nSystem specification\r\nControlled test using exact LED delivery routine.\r\n\r\nCommercial proposal\r\nNo commercial value. Test only.",
  'images'=>[],
  'total'=>0,
  'currency'=>'EUR'
];
try{
  $result=SimworxLedQuoteActions::deliver(
    $quote,
    [],
    static fn(string $to,string $subject,string $body,string $headers):bool=>@mail($to,$subject,$body,$headers),
    static function(array $quote,array $post):void{}
  );
  echo json_encode(['ok'=>true,'reference'=>$reference,'result'=>$result],JSON_UNESCAPED_SLASHES);
}catch(Throwable $e){
  http_response_code(500);
  echo json_encode(['ok'=>false,'reference'=>$reference,'message'=>$e->getMessage()],JSON_UNESCAPED_SLASHES);
}
