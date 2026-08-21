<?php

declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');

function respond(int $status, array $payload): never
{
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function textValue(mixed $value, int $maxLength): string
{
    if (!is_string($value)) {
        return '';
    }

    $value = trim($value);
    $value = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u', '', $value) ?? '';
    $length = function_exists('mb_strlen') ? mb_strlen($value) : strlen($value);
    if ($length > $maxLength) {
        return '';
    }

    return $value;
}

function rateLimit(string $address): bool
{
    $directory = '/var/cache/parkskazka-charity';
    if (!is_dir($directory) && !@mkdir($directory, 0750, true) && !is_dir($directory)) {
        return true;
    }

    $path = $directory . '/' . hash('sha256', $address) . '.json';
    $handle = @fopen($path, 'c+');
    if ($handle === false || !flock($handle, LOCK_EX)) {
        if (is_resource($handle)) {
            fclose($handle);
        }
        return true;
    }

    $raw = stream_get_contents($handle);
    $entries = is_string($raw) ? json_decode($raw, true) : [];
    if (!is_array($entries)) {
        $entries = [];
    }

    $now = time();
    $entries = array_values(array_filter($entries, static fn ($value): bool => is_int($value) && $value > $now - 900));
    $allowed = count($entries) < 5;
    if ($allowed) {
        $entries[] = $now;
        rewind($handle);
        ftruncate($handle, 0);
        fwrite($handle, json_encode($entries));
        fflush($handle);
    }

    flock($handle, LOCK_UN);
    fclose($handle);
    return $allowed;
}

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    header('Allow: POST');
    respond(405, ['ok' => false, 'message' => 'Method not allowed']);
}

$allowedOrigins = ['https://parkskazka.ru', 'https://www.parkskazka.ru'];
$origin = rtrim((string) ($_SERVER['HTTP_ORIGIN'] ?? ''), '/');
$referer = (string) ($_SERVER['HTTP_REFERER'] ?? '');
if (($origin !== '' && !in_array($origin, $allowedOrigins, true))
    || ($origin === '' && !str_starts_with($referer, 'https://parkskazka.ru/charity/'))) {
    respond(403, ['ok' => false, 'message' => 'Request source is not allowed']);
}

$contentLength = (int) ($_SERVER['CONTENT_LENGTH'] ?? 0);
if ($contentLength < 1 || $contentLength > 16384) {
    respond(413, ['ok' => false, 'message' => 'Invalid request size']);
}

$payload = json_decode((string) file_get_contents('php://input'), true);
if (!is_array($payload)) {
    respond(400, ['ok' => false, 'message' => 'Invalid JSON']);
}

if (textValue($payload['website'] ?? '', 200) !== '') {
    respond(200, ['ok' => true]);
}

$elapsed = filter_var($payload['elapsed_ms'] ?? null, FILTER_VALIDATE_INT);
if ($elapsed === false) {
    $elapsed = 0;
}
if ($elapsed < 1200 || $elapsed > 86400000) {
    respond(400, ['ok' => false, 'message' => 'Invalid form timing']);
}

$participantType = textValue($payload['participant_type'] ?? '', 32);
$participantLabels = [
    'company' => 'От компании',
    'foundation' => 'От фонда или НКО',
    'personal' => 'Лично',
];
$organization = textValue($payload['organization'] ?? '', 160);
$contactName = textValue($payload['contact_name'] ?? '', 120);
$phone = textValue($payload['phone'] ?? '', 40);
$email = textValue($payload['email'] ?? '', 160);
$comment = textValue($payload['comment'] ?? '', 600);
$consent = filter_var($payload['consent'] ?? false, FILTER_VALIDATE_BOOL);

$phoneDigits = preg_replace('/\D+/', '', $phone) ?? '';
if (!isset($participantLabels[$participantType])
    || $organization === ''
    || $contactName === ''
    || strlen($phoneDigits) < 7
    || $comment === ''
    || !$consent
    || ($email !== '' && filter_var($email, FILTER_VALIDATE_EMAIL) === false)) {
    respond(422, ['ok' => false, 'message' => 'Required fields are invalid']);
}

if (!rateLimit((string) ($_SERVER['REMOTE_ADDR'] ?? 'unknown'))) {
    respond(429, ['ok' => false, 'message' => 'Too many requests']);
}

$pageUrl = textValue($payload['page_url'] ?? '', 1000);
$pageHost = parse_url($pageUrl, PHP_URL_HOST);
if (!in_array($pageHost, ['parkskazka.ru', 'www.parkskazka.ru'], true)) {
    $pageUrl = 'https://parkskazka.ru/charity/';
}

$fields = [
    'NAME' => $contactName,
    'SOURCE_ID' => 'WEB',
    'TITLE' => 'Заявка на Давайте подарим детям день в Сказке',
    'COMMENTS' => "Как вы хотите участвовать: {$participantLabels[$participantType]}\nКомментарий: {$comment}\nСогласие на обработку персональных данных: получено " . gmdate('c'),
    'PHONE' => [['VALUE' => $phone, 'VALUE_TYPE' => 'WORK']],
    'COMPANY_TITLE' => $organization,
    'UF_CRM_1786958358509' => 'Социальная программа Парка Сказка',
    'UF_CRM_1786957436490' => 2594,
    'UF_CRM_1786957550526' => $pageUrl,
    'UTM_SOURCE' => textValue($payload['utm_source'] ?? '', 255),
    'UTM_MEDIUM' => textValue($payload['utm_medium'] ?? '', 255),
    'UTM_CAMPAIGN' => textValue($payload['utm_campaign'] ?? '', 255),
    'UTM_CONTENT' => textValue($payload['utm_content'] ?? '', 255),
    'UTM_TERM' => textValue($payload['utm_term'] ?? '', 255),
    'UF_CRM_1786957941367' => textValue($payload['yclid'] ?? '', 255),
    'UF_CRM_1786957965485' => textValue($payload['gclid'] ?? '', 255),
    'UF_CRM_1786957992112' => textValue($payload['client_id'] ?? '', 255),
];

if ($email !== '') {
    $fields['EMAIL'] = [['VALUE' => $email, 'VALUE_TYPE' => 'WORK']];
}

$configuration = @parse_ini_file('/etc/parkskazka/charity-bitrix.env', false, INI_SCANNER_RAW);
$webhookUrl = is_array($configuration) ? trim((string) ($configuration['BITRIX_WEBHOOK_URL'] ?? '')) : '';
if ($webhookUrl === '' || !str_starts_with($webhookUrl, 'https://portal.parkskazka.com/rest/')) {
    error_log('Charity lead integration is not configured');
    respond(503, ['ok' => false, 'message' => 'Integration is unavailable']);
}

$request = curl_init($webhookUrl);
curl_setopt_array($request, [
    CURLOPT_POST => true,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HTTPHEADER => ['Accept: application/json', 'Content-Type: application/json'],
    CURLOPT_POSTFIELDS => json_encode(['fields' => $fields], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
    CURLOPT_CONNECTTIMEOUT => 4,
    CURLOPT_TIMEOUT => 10,
    CURLOPT_SSL_VERIFYPEER => true,
    CURLOPT_SSL_VERIFYHOST => 2,
]);

$responseBody = curl_exec($request);
$responseCode = (int) curl_getinfo($request, CURLINFO_RESPONSE_CODE);
$transportError = curl_errno($request);
curl_close($request);

$response = is_string($responseBody) ? json_decode($responseBody, true) : null;
if ($transportError !== 0 || $responseCode < 200 || $responseCode >= 300 || !is_array($response) || !isset($response['result'])) {
    $errorCode = is_array($response) ? textValue($response['error'] ?? '', 80) : '';
    error_log(sprintf('Charity lead request failed: http=%d transport=%d code=%s', $responseCode, $transportError, $errorCode));
    respond(502, ['ok' => false, 'message' => 'CRM request failed']);
}

respond(200, ['ok' => true]);
