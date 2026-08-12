<?php
/**
 * comments.php — kommentarer pr. taktikscene.
 *
 *   GET  ?scene=krydsloeb        -> {"ok":true,"comments":[{name,text,created}]}
 *   POST {scene,name,text,hp}    -> gemmer og sender en mail
 *
 * Data ligger i SQLite ved siden af filen. Der er ingen login og ingen
 * redigering — det er et opslagsbræt til et motionshold, ikke et forum.
 * Sletning sker ved at åbne databasen manuelt.
 */

declare(strict_types=1);

const MAIL_TO        = 'allan.noergaard.skov@gmail.com';
const MAIL_FROM      = 'no-reply@vhg.dk';
const MAIL_FROM_NAME = 'VHG Floorball-taktik';
const SITE_URL       = 'https://www.vhg.dk/floorball/';

const MAX_NAME  = 40;
const MAX_TEXT  = 600;
const MAX_SHOWN = 100;   // antal kommentarer der vises pr. scene

// Simpel spærre mod at nogen holder Enter nede.
const MIN_SECONDS_BETWEEN = 20;
const MAX_PER_HOUR        = 8;

// Tiderne gemmes i UTC og sendes som ISO 8601 med Z, så browseren selv kan
// vise dansk lokaltid. Ellers ser en kommentar skrevet efter træning ud til
// at være fra to timer siden.
const SELECT_SQL = "SELECT name, text, strftime('%Y-%m-%dT%H:%M:%SZ', created) AS created
                    FROM comments";

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');

function fail(string $msg, int $code = 400): never {
    http_response_code($code);
    echo json_encode(['ok' => false, 'error' => $msg], JSON_UNESCAPED_UNICODE);
    exit;
}

function db(): PDO {
    $dir = __DIR__ . '/data';
    if (!is_dir($dir) && !@mkdir($dir, 0775, true) && !is_dir($dir)) {
        fail('Kan ikke oprette datamappen.', 500);
    }
    $pdo = new PDO('sqlite:' . $dir . '/comments.sqlite');
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
    $pdo->exec('CREATE TABLE IF NOT EXISTS comments (
        id       INTEGER PRIMARY KEY AUTOINCREMENT,
        scene    TEXT NOT NULL,
        name     TEXT NOT NULL,
        text     TEXT NOT NULL,
        created  TEXT NOT NULL,
        ip       TEXT
    )');
    $pdo->exec('CREATE INDEX IF NOT EXISTS idx_scene ON comments(scene, id)');
    return $pdo;
}

/** Scene-id'er er kendte, korte slugs — alt andet afvises på forhånd. */
function cleanScene(?string $s): string {
    $s = trim((string) $s);
    if (!preg_match('/^[a-z0-9-]{1,40}$/', $s)) fail('Ukendt taktik.');
    return $s;
}

function clientIp(): string {
    return (string) ($_SERVER['REMOTE_ADDR'] ?? '');
}

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

/* ------------------------------------------------------------------ GET */

if ($method === 'GET') {
    $scene = cleanScene($_GET['scene'] ?? '');
    $st = db()->prepare(SELECT_SQL . '
                         WHERE scene = ? ORDER BY id ASC LIMIT ' . MAX_SHOWN);
    $st->execute([$scene]);
    echo json_encode(['ok' => true, 'comments' => $st->fetchAll()], JSON_UNESCAPED_UNICODE);
    exit;
}

if ($method !== 'POST') fail('Kun GET og POST.', 405);

/* ----------------------------------------------------------------- POST */

$raw = file_get_contents('php://input') ?: '';
$in  = json_decode($raw, true);
if (!is_array($in)) fail('Ugyldige data.');

// Honningkrukke: feltet er skjult for mennesker, så udfyldt = robot.
// Vi svarer venligt ok, så den ikke prøver igen med en anden metode.
if (trim((string) ($in['hp'] ?? '')) !== '') {
    echo json_encode(['ok' => true, 'comments' => []], JSON_UNESCAPED_UNICODE);
    exit;
}

$scene = cleanScene($in['scene'] ?? '');
$name  = trim((string) ($in['name'] ?? ''));
$text  = trim((string) ($in['text'] ?? ''));

// Fjern styretegn, men behold linjeskift.
$name = preg_replace('/[\x00-\x1F\x7F]/u', '', $name) ?? '';
$text = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u', '', $text) ?? '';

if ($name === '' || mb_strlen($name) > MAX_NAME) fail('Skriv dit navn (højst ' . MAX_NAME . ' tegn).');
if ($text === '') fail('Skriv en besked.');
if (mb_strlen($text) > MAX_TEXT) fail('Beskeden må højst fylde ' . MAX_TEXT . ' tegn.');

$pdo = db();
$ip  = clientIp();

$st = $pdo->prepare("SELECT COUNT(*) c,
                            COALESCE(MAX(strftime('%s','now') - strftime('%s',created)), 999999) age
                     FROM comments WHERE ip = ? AND created > datetime('now','-1 hour')");
$st->execute([$ip]);
$rate = $st->fetch();
if ((int) $rate['age'] < MIN_SECONDS_BETWEEN) fail('Vent lige et øjeblik, før du sender igen.', 429);
if ((int) $rate['c'] >= MAX_PER_HOUR) fail('Du har skrevet en del på kort tid. Prøv igen om lidt.', 429);

$created = gmdate('Y-m-d H:i:s');
$st = $pdo->prepare('INSERT INTO comments (scene, name, text, created, ip) VALUES (?,?,?,?,?)');
$st->execute([$scene, $name, $text, $created, $ip]);

/* Mail til Allan. Fejler den, skal kommentaren stadig være gemt — derfor
   sker det efter indsættelsen, og resultatet påvirker ikke svaret. */
$subject = "Ny kommentar på floorball-siden: $scene";
$body = "$name har skrevet en kommentar til taktikken \"$scene\":\n\n"
      . "$text\n\n"
      . "-----\n"
      . SITE_URL . "#$scene\n"
      . "Tidspunkt (UTC): $created\n";
$headers = implode("\r\n", [
    'From: ' . MAIL_FROM_NAME . ' <' . MAIL_FROM . '>',
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
]);
@mail(MAIL_TO, '=?UTF-8?B?' . base64_encode($subject) . '?=', base64_encode($body), $headers);

$st = $pdo->prepare(SELECT_SQL . '
                     WHERE scene = ? ORDER BY id ASC LIMIT ' . MAX_SHOWN);
$st->execute([$scene]);
echo json_encode(['ok' => true, 'comments' => $st->fetchAll()], JSON_UNESCAPED_UNICODE);
