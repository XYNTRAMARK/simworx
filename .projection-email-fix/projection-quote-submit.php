<?php
declare(strict_types=1);

header('X-Content-Type-Options: nosniff');
header('X-Robots-Tag: noindex, nofollow, noarchive');
header('Cache-Control: no-store');
header('Referrer-Policy: no-referrer');

$protectionPath=__DIR__.'/forms/anti-spam.php';

if(($_GET['action']??'')==='capabilities'){
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode([
        'ok'=>is_readable($protectionPath)&&function_exists('mail'),
        'protected'=>is_readable($protectionPath),
        'mail'=>function_exists('mail'),
        'action'=>'projection-email'
    ]);
    exit;
}

header('Content-Type: application/json; charset=utf-8');
$reply=static function(int $code,array $body):never{
    http_response_code($code);
    echo json_encode($body,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES);
    exit;
};

if(($_SERVER['REQUEST_METHOD']??'')!=='POST'){
    header('Allow: POST');
    $reply(405,['ok'=>false,'message'=>'Use the proposal email button to continue.']);
}

$origin=$_SERVER['HTTP_ORIGIN']??'';
if($origin!==''&&!in_array($origin,['https://www.sim-worx.com','https://sim-worx.com'],true)){
    $reply(403,['ok'=>false,'message'=>'Please use the Simworx configurator to send this proposal.']);
}
// Image-rich proposals include four configured renderer views; allow up to 2.5 MB while keeping a hard request cap.
if((int)($_SERVER['CONTENT_LENGTH']??0)>2500000){
    $reply(413,['ok'=>false,'message'=>'The proposal is too large to send. Please save it as PDF instead.']);
}

try{
    if(!is_file($protectionPath))throw new RuntimeException('Proposal sending is temporarily unavailable. Please email info@sim-worx.com.');
    require_once $protectionPath;
    $error=(new SimworxFormProtection('contact'))->validate($_POST,$_SERVER);
    if($error!==null){
        if(($error['status']??0)===429)header('Retry-After: 600');
        $reply((int)$error['status'],['ok'=>false,'message'=>$error['message']]);
    }

    $email=strtolower(trim((string)($_POST['email']??'')));
    if(strlen($email)>254||!filter_var($email,FILTER_VALIDATE_EMAIL))throw new InvalidArgumentException('Enter a valid recipient email address.');

    $name=trim((string)($_POST['name']??''));
    if(strlen($name)>100||preg_match('/[\x00-\x1f\x7f]/',$name))throw new InvalidArgumentException('Enter a valid recipient name.');

    $reference=trim((string)($_POST['proposal_reference']??''));
    if(!preg_match('/^[A-Za-z0-9._-]{3,90}$/D',$reference))throw new InvalidArgumentException('The proposal reference could not be confirmed.');

    $html=(string)($_POST['proposal_html']??'');
    $text=(string)($_POST['proposal_text']??'');
    // proposal_html can contain embedded JPEG data URLs from the configured 3D views.
    if(strlen($html)<200||strlen($html)>1800000||strlen($text)<100||strlen($text)>70000){
        throw new InvalidArgumentException('The proposal document could not be confirmed. Please refresh the configurator and try again.');
    }
    if(!str_contains($html,'Simworx Projection System Proposal')||!str_contains($html,'System specification')||!str_contains($html,'Commercial proposal')){
        throw new InvalidArgumentException('The proposal document is incomplete. Please refresh the configurator and try again.');
    }

    // The browser creates this document from the canonical proposal state. Remove
    // executable/embedded content before it is used as the email body.
    $html=preg_replace('#<(script|iframe|object|embed|form)[^>]*>.*?</\\1>#is','',$html)??'';
    $html=preg_replace('/\son[a-z]+\s*=\s*(["\']).*?\1/is','',$html)??'';
    $html=preg_replace('/javascript\s*:/i','',$html)??'';

    $greeting=$name!==''?'<p>Hello '.htmlspecialchars($name,ENT_QUOTES|ENT_SUBSTITUTE,'UTF-8').',</p>':'';
    $body='<!doctype html><html><body style="font-family:Arial,sans-serif;color:#17202a">'
        .$greeting
        .'<p>Please find your SIMWORX projection system proposal below. It contains both the technical specification and commercial proposal.</p>'
        .'<hr style="border:0;border-top:1px solid #d8dde3;margin:24px 0">'
        .$html
        .'<hr style="border:0;border-top:1px solid #d8dde3;margin:24px 0">'
        .'<p style="font-size:12px;color:#59636e">This configured proposal is subject to final technical review, delivery confirmation and formal quotation by SIMWORX.</p>'
        .'</body></html>';

    $subject='Simworx projection proposal '.$reference;
    $headers="From: SIMWORX <info@sim-worx.com>\r\n"
        ."Reply-To: info@sim-worx.com\r\n"
        ."MIME-Version: 1.0\r\n"
        ."Content-Type: text/html; charset=UTF-8";

    if(!@mail($email,$subject,$body,$headers)){
        throw new RuntimeException('The proposal email could not be sent. Please try again or email info@sim-worx.com.');
    }

    $reply(200,['ok'=>true,'message'=>'Proposal sent successfully.','reference'=>$reference]);
}catch(InvalidArgumentException $e){
    $reply(422,['ok'=>false,'message'=>$e->getMessage()]);
}catch(Throwable $e){
    $reply(503,['ok'=>false,'message'=>$e instanceof RuntimeException?$e->getMessage():'Proposal sending is temporarily unavailable. Please email info@sim-worx.com.']);
}
