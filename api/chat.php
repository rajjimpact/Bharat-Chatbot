<?php
/**
 * Bharat — api.php
 * PHP backend: processes user messages and calls the Gemini API.
 * This file handles CORS, validates input, and routes messages to Gemini.
 */

declare(strict_types=1);

// ─── CORS & Headers ──────────────────────────────────────────────────────────
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

// Only accept POST
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method Not Allowed']);
    exit;
}

// ─── Input validation ────────────────────────────────────────────────────────
$rawMessage = trim($_POST['message'] ?? '');
$historyRaw = $_POST['history'] ?? '[]';
$mediaBase64 = $_POST['mediaBase64'] ?? '';
$mediaMime   = $_POST['mediaMime'] ?? '';

if ($rawMessage === '' && $mediaBase64 === '') {
    http_response_code(400);
    echo json_encode(['error' => 'Empty message']);
    exit;
}

// Sanitise basic structure
$history = json_decode($historyRaw, true) ?: [];

// ─── Gemini API Configuration ────────────────────────────────────────────────
// IMPORTANT: Replace this placeholder with your actual Gemini API Key from Google AI Studio.
// Get yours at: https://aistudio.google.com/app/apikey
define('GEMINI_API_KEY', 'AIzaSyBMztMvRprVnwoU0JXL5gPoDJ1-jCuwym8');

/**
 * Calls the Gemini 1.5 Flash API to get a response.
 */
function callGeminiAPI(string $message, array $history): ?string {
    $apiKey = GEMINI_API_KEY;
    if ($apiKey === 'YOUR_GEMINI_API_KEY_HERE' || empty($apiKey)) {
        return "⚠️ **API Key Missing!**\n\nPlease open `api.php` and add your **Gemini API Key** to enable my AI capabilities.\nYou can get a free one from [Google AI Studio](https://aistudio.google.com/app/apikey).";
    }

    $url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=' . $apiKey;

    // Define the system instructions to maintain the bot's identity
    $systemInstruction = [
        'parts' => [
            ['text' => "You are Bharat, a helpful AI assistant built. You are an expert in programming, health, productivity, cooking and science. Provide helpful, concise and well-formatted markdown responses."]
        ]
    ];

    $contents = [];
    
    // Add conversation history
    foreach ($history as $turn) {
        $role = ($turn['role'] ?? '') === 'bot' ? 'model' : 'user';
        $text = $turn['text'] ?? '';
        if (empty($text)) continue;
        
        $contents[] = [
            'role' => $role,
            'parts' => [['text' => $text]]
        ];
    }

    // Add current user message
    $userParts = [];
    if (!empty($message)) {
        $userParts[] = ['text' => $message];
    } else {
        $userParts[] = ['text' => "What is in this image?"];
    }

    global $mediaBase64, $mediaMime;
    if (!empty($mediaBase64) && !empty($mediaMime)) {
        $userParts[] = [
            'inlineData' => [
                'mimeType' => $mediaMime,
                'data'     => $mediaBase64
            ]
        ];
    }

    $contents[] = [
        'role'  => 'user',
        'parts' => $userParts
    ];

    $payload = [
        'systemInstruction' => $systemInstruction,
        'contents' => $contents,
        'generationConfig' => [
            'temperature' => 0.7,
        ]
    ];

    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Content-Type: application/json'
    ]);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));

    // Disable SSL verification for local XAMPP environments to prevent cURL errors
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
    curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, false);
    
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($httpCode !== 200 || !$response) {
        error_log("Gemini API Error: " . $response);
        return "Oops! I encountered an error communicating with the AI. Please check the API key and internet connection.";
    }

    $data = json_decode($response, true);
    return $data['candidates'][0]['content']['parts'][0]['text'] ?? "Sorry, I couldn't generate a proper response.";
}

// ─── Build reply ─────────────────────────────────────────────────────────────
$reply = callGeminiAPI($rawMessage, $history);

// ─── Response ────────────────────────────────────────────────────────────────
echo json_encode([
    'reply'     => $reply,
    'timestamp' => date('c'),
    'version'   => '1.1.0 (Gemini)',
], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
