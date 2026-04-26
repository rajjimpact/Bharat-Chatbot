<?php
/**
 * Bharat — chat.php
 * PHP backend for the Bharat AI Chatbot.
 * Powered by Google Gemini API.
 *
 * HOW TO SET UP:
 *   1. Go to https://aistudio.google.com/app/apikey
 *   2. Create a free API key
 *   3. Paste it below between the quotes on the GEMINI_API_KEY line
 *   4. Save this file and you're done!
 */

declare(strict_types=1);

// Catch all PHP errors and return them as valid JSON so the frontend can read them!
set_error_handler(function($errno, $errstr, $errfile, $errline) {
    http_response_code(500);
    echo json_encode(['error' => "PHP Error [$errno]: $errstr on line $errline"]);
    exit;
});
set_exception_handler(function($e) {
    http_response_code(500);
    echo json_encode(['error' => "PHP Exception: " . $e->getMessage()]);
    exit;
});

// ════════════════════════════════════════════════════════════════
//   ✏️  GEMINI API KEY IS NOW READ FROM ENVIRONMENT VARIABLES
// ════════════════════════════════════════════════════════════════
// On Vercel, configure this in Settings > Environment Variables as GEMINI_API_KEY
$envKey = getenv('GEMINI_API_KEY');
define('GEMINI_API_KEY', $envKey ? $envKey : '');
// ════════════════════════════════════════════════════════════════

// Gemini model to use (no need to change this)
define('GEMINI_MODEL', 'gemini-2.5-flash');

// ─── CORS & Headers ──────────────────────────────────────────────────────────
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, X-Requested-With');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method Not Allowed. Use POST.']);
    exit;
}

// ─── Read Input ───────────────────────────────────────────────────────────────
$rawMessage  = trim($_POST['message']     ?? '');
$historyRaw  = $_POST['history']          ?? '[]';
$mediaBase64 = trim($_POST['mediaBase64'] ?? '');
$mediaMime   = trim($_POST['mediaMime']   ?? '');

if ($rawMessage === '' && $mediaBase64 === '') {
    http_response_code(400);
    echo json_encode(['error' => 'Empty message.']);
    exit;
}

$history = [];
$decoded = json_decode($historyRaw, true);
if (is_array($decoded)) {
    $history = array_slice($decoded, -10);
}

// ─── Gemini API Call ─────────────────────────────────────────────────────────
function callGeminiAPI(
    string $message,
    array  $history,
    string $mediaBase64 = '',
    string $mediaMime   = ''
): string {

    $apiKey = GEMINI_API_KEY;

    // Check if the key has been filled in
    if (empty(trim($apiKey))) {
        return "⚠️ **API Key Not Set!**\n\n"
             . "Please open `api/chat.php` and paste your Gemini API key on **line 16**.\n\n"
             . "👉 Get a free key at [Google AI Studio](https://aistudio.google.com/app/apikey)";
    }

    // Basic format check — Gemini keys always start with "AIzaSy"
    if (!str_starts_with($apiKey, 'AIzaSy')) {
        return "⚠️ **Invalid API Key Format!**\n\n"
             . "Your key does not look correct. A valid Gemini API key:\n"
             . "- Starts with **AIzaSy**\n"
             . "- Is around 39 characters long\n\n"
             . "Double-check your key at [Google AI Studio](https://aistudio.google.com/app/apikey)";
    }

    $model = GEMINI_MODEL;
    $url   = "https://generativelanguage.googleapis.com/v1beta/models/{$model}:generateContent?key={$apiKey}";

    // Bharat's personality & instructions
    $systemInstruction = [
        'parts' => [[
            'text' => "You are Bharat, a friendly and knowledgeable AI assistant. "
                    . "You are an expert in programming, health & wellness, food recipes, "
                    . "social etiquette, science, history, and general knowledge. "
                    . "Always respond in clear, well-structured markdown. "
                    . "Be concise, helpful, and warm in tone."
        ]]
    ];

    // Build conversation history
    $contents = [];
    foreach ($history as $turn) {
        $role = ($turn['role'] ?? '') === 'bot' ? 'model' : 'user';
        $text = trim($turn['text'] ?? '');
        if ($text === '') continue;
        $contents[] = [
            'role'  => $role,
            'parts' => [['text' => $text]]
        ];
    }

    // Build current user message
    $userParts = [];
    if ($message !== '') {
        $userParts[] = ['text' => $message];
    } elseif ($mediaBase64 !== '') {
        $userParts[] = ['text' => 'Describe what you see in this image in detail.'];
    }

    // Attach image if provided
    if ($mediaBase64 !== '' && $mediaMime !== '') {
        $userParts[] = [
            'inlineData' => [
                'mimeType' => $mediaMime,
                'data'     => $mediaBase64
            ]
        ];
    }

    if (empty($userParts)) {
        return "⚠️ Could not understand your message. Please try again.";
    }

    $contents[] = ['role' => 'user', 'parts' => $userParts];

    $payload = [
        'systemInstruction' => $systemInstruction,
        'contents'          => $contents,
        'generationConfig'  => [
            'temperature'     => 0.75,
            'maxOutputTokens' => 1024,
        ]
    ];

    // Send request via cURL
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST           => true,
        CURLOPT_HTTPHEADER     => ['Content-Type: application/json'],
        CURLOPT_POSTFIELDS     => json_encode($payload, JSON_UNESCAPED_UNICODE),
        CURLOPT_TIMEOUT        => 30,
        CURLOPT_CONNECTTIMEOUT => 10,
        CURLOPT_SSL_VERIFYPEER => false,   // needed for local XAMPP
        CURLOPT_SSL_VERIFYHOST => false,
    ]);

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlErr  = curl_error($ch);
    curl_close($ch);

    // Handle cURL / network failure
    if ($response === false || $curlErr !== '') {
        error_log("Bharat cURL Error: {$curlErr}");
        return "⚠️ **Network Error:** Could not reach Google's servers.\n\n"
             . "Check your internet connection and make sure Apache (XAMPP) is running.\n\n"
             . "_Details: {$curlErr}_";
    }

    // Handle HTTP errors from Google
    if ($httpCode !== 200) {
        $errData = json_decode($response, true);
        $errMsg  = $errData['error']['message'] ?? 'Unknown error';
        error_log("Bharat Gemini HTTP {$httpCode}: {$errMsg}");

        if ($httpCode === 401 || $httpCode === 403) {
            return "⚠️ **API Key Rejected ({$httpCode}):** {$errMsg}\n\n"
                 . "Your key may be invalid, expired, or have no quota left.\n"
                 . "Get a new key at [Google AI Studio](https://aistudio.google.com/app/apikey)";
        }
        if ($httpCode === 429) {
            return "⚠️ **Rate Limit Hit (429):** You've exceeded the free-tier quota.\n\n"
                 . "Please wait a moment and try again.";
        }
        return "⚠️ **API Error ({$httpCode}):** {$errMsg}";
    }

    // Parse the response
    $data         = json_decode($response, true);
    $finishReason = $data['candidates'][0]['finishReason'] ?? '';

    if ($finishReason === 'SAFETY') {
        return "⚠️ My content filters flagged that request. Please try rephrasing.";
    }

    $text = $data['candidates'][0]['content']['parts'][0]['text'] ?? '';
    if (trim($text) === '') {
        return "🤔 I got an empty response. Please try rephrasing your question.";
    }

    return trim($text);
}

// ─── Run & Return JSON ────────────────────────────────────────────────────────
$reply = callGeminiAPI($rawMessage, $history, $mediaBase64, $mediaMime);

echo json_encode([
    'reply'     => $reply,
    'timestamp' => date('c'),
    'model'     => GEMINI_MODEL,
    'version'   => '2.0.0',
], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
