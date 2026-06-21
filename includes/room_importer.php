<?php
declare(strict_types=1);

require_once __DIR__ . '/base.php';

function room_import_safe_url(string $url): string {
    $url = trim($url);
    if ($url === '') throw new RuntimeException('URL required.');
    if (!preg_match('#^https?://#i', $url)) throw new RuntimeException('Only HTTP and HTTPS URLs can be imported.');
    $parts = parse_url($url);
    if (!$parts || empty($parts['scheme']) || empty($parts['host'])) {
        throw new RuntimeException('That URL does not look valid.');
    }
    $scheme = strtolower((string)$parts['scheme']);
    if (!in_array($scheme, ['http', 'https'], true)) {
        throw new RuntimeException('Only HTTP and HTTPS URLs can be imported.');
    }
    if (!preview_host_is_safe((string)$parts['host'])) {
        throw new RuntimeException('That host is not allowed for imports.');
    }
    return $url;
}

function room_import_fetch_url(string $url, int $maxBytes, string $accept, int $redirects = 3): array {
    $url = room_import_safe_url($url);
    $context = stream_context_create([
        'http' => [
            'method' => 'GET',
            'timeout' => 12,
            'follow_location' => 0,
            'ignore_errors' => true,
            'header' => "User-Agent: ChatSpaceCE-RoomImporter/1.0\r\nAccept: {$accept}\r\n",
        ],
        'ssl' => [
            'verify_peer' => true,
            'verify_peer_name' => true,
        ],
    ]);
    $handle = @fopen($url, 'rb', false, $context);
    if (!$handle) throw new RuntimeException('Could not fetch that URL.');
    $body = stream_get_contents($handle, $maxBytes + 1);
    $meta = stream_get_meta_data($handle);
    fclose($handle);
    if (!is_string($body)) throw new RuntimeException('Could not read the remote URL.');
    if (strlen($body) > $maxBytes) throw new RuntimeException('The remote file is too large to import.');

    $headers = $meta['wrapper_data'] ?? [];
    if (is_string($headers)) $headers = [$headers];
    $status = 0;
    $location = '';
    $contentType = '';
    foreach ($headers as $header) {
        if (preg_match('~^HTTP/\S+\s+(\d+)~i', (string)$header, $m)) $status = (int)$m[1];
        if (stripos((string)$header, 'Location:') === 0) $location = trim(substr((string)$header, 9));
        if (stripos((string)$header, 'Content-Type:') === 0) $contentType = trim(substr((string)$header, 13));
    }
    if ($status >= 300 && $status < 400 && $location !== '' && $redirects > 0) {
        return room_import_fetch_url(absolutize_preview_url($location, $url), $maxBytes, $accept, $redirects - 1);
    }
    if ($status >= 400) throw new RuntimeException('The remote server returned HTTP ' . $status . '.');

    return ['body' => $body, 'url' => (string)($meta['uri'] ?? $url), 'content_type' => $contentType];
}

function room_import_style_value(string $style, string $property): string {
    if (preg_match('~(?:^|;)\s*' . preg_quote($property, '~') . '\s*:\s*([^;]+)~i', $style, $m)) {
        return trim((string)$m[1], " \t\r\n\"'");
    }
    return '';
}

function room_import_css_color(string $value): string {
    $value = trim($value);
    if ($value === '') return '';
    if (preg_match('~^#[0-9a-f]{3,8}$~i', $value)) return $value;
    if (preg_match('~^(?:rgb|rgba|hsl|hsla)\([0-9.%\s,+-]+\)$~i', $value)) return $value;
    if (preg_match('~^[a-z]{3,24}$~i', $value)) return strtolower($value);
    return '';
}

function room_import_style_from_node(DOMNode $node, array $parent = []): array {
    $style = $parent;
    if (!$node instanceof DOMElement) return $style;
    $inline = (string)$node->getAttribute('style');
    $color = room_import_css_color(room_import_style_value($inline, 'color') ?: (string)$node->getAttribute('color') ?: (string)$node->getAttribute('text'));
    if ($color !== '') $style['color'] = $color;
    $fontSize = room_import_style_value($inline, 'font-size');
    if ($fontSize !== '' && preg_match('~^[0-9.]+(?:px|pt|em|rem|%)$~i', $fontSize)) $style['font_size'] = $fontSize;
    $align = strtolower(room_import_style_value($inline, 'text-align') ?: (string)$node->getAttribute('align'));
    if (in_array($align, ['left', 'center', 'right'], true)) $style['text_align'] = $align;
    return $style;
}

function room_import_background_image(string $style): string {
    if (preg_match('~background(?:-image)?\s*:\s*[^;]*url\((["\']?)(.*?)\1\)~i', $style, $m)) {
        return trim((string)$m[2]);
    }
    return '';
}

function room_import_candidate_media_url(string $value, string $baseUrl): string {
    $value = html_entity_decode(trim($value), ENT_QUOTES | ENT_HTML5, 'UTF-8');
    if ($value === '' || str_starts_with(strtolower($value), 'javascript:')) return '';
    $absolute = absolutize_preview_url($value, $baseUrl);
    if (!preg_match('#^https?://#i', $absolute)) return '';
    $parts = parse_url($absolute);
    $baseParts = parse_url($baseUrl);
    $assetHost = strtolower((string)($parts['host'] ?? ''));
    $baseHost = strtolower((string)($baseParts['host'] ?? ''));
    if (!$parts || $assetHost === '') return '';
    if ($assetHost !== $baseHost && !preview_host_is_safe($assetHost)) return '';
    return $absolute;
}

function room_import_media_label(string $url): string {
    $path = (string)(parse_url($url, PHP_URL_PATH) ?: '');
    $base = basename($path);
    $base = preg_replace('~\.[a-z0-9]{2,5}$~i', '', $base) ?: 'Audio';
    $base = trim(str_replace(['_', '-'], ' ', $base));
    return $base !== '' ? ucwords($base) : 'Audio';
}

function room_import_parse(string $html, string $sourceUrl): array {
    $dom = new DOMDocument();
    $previous = libxml_use_internal_errors(true);
    $encoded = '<?xml encoding="UTF-8">' . $html;
    $dom->loadHTML($encoded, LIBXML_NOERROR | LIBXML_NOWARNING | LIBXML_NONET);
    libxml_clear_errors();
    libxml_use_internal_errors($previous);

    $xpath = new DOMXPath($dom);
    $title = trim((string)($xpath->evaluate('string(//title)') ?: ''));
    $body = $dom->getElementsByTagName('body')->item(0);
    $bodyStyle = $body instanceof DOMElement ? (string)$body->getAttribute('style') : '';
    $bodyBg = $body instanceof DOMElement ? (string)$body->getAttribute('background') : '';
    $backgroundImage = $bodyBg !== '' ? room_import_candidate_media_url($bodyBg, $sourceUrl) : room_import_candidate_media_url(room_import_background_image($bodyStyle), $sourceUrl);
    $backgroundColor = '#000000';
    if ($body instanceof DOMElement) {
        $bgColor = room_import_css_color((string)$body->getAttribute('bgcolor') ?: room_import_style_value($bodyStyle, 'background-color'));
        if ($bgColor !== '') $backgroundColor = $bgColor;
    }

    $sections = [];
    $audio = [];
    $seenAudio = [];
    $textBuffer = '';
    $textStyle = [];
    $textBudget = 1800;

    $flushText = function () use (&$sections, &$textBuffer, &$textStyle, &$textBudget): void {
        $text = trim(preg_replace('~[ \t\r\n]+~u', ' ', $textBuffer) ?? '');
        $textBuffer = '';
        if ($text === '' || $textBudget <= 0) return;
        if (function_exists('mb_substr')) $text = mb_substr($text, 0, $textBudget, 'UTF-8');
        else $text = substr($text, 0, $textBudget);
        $textBudget -= strlen($text);
        $sections[] = ['type' => 'text', 'text' => $text, 'style' => $textStyle];
    };

    $rememberAudio = function (string $url) use (&$audio, &$seenAudio): void {
        if ($url === '' || isset($seenAudio[$url]) || count($audio) >= 12) return;
        if (!preg_match('~\.(?:mp3|m4a|aac|ogg|oga|opus|wav|m3u|m3u8|pls|asx|wma)(?:[?#].*)?$~i', $url)) return;
        $seenAudio[$url] = true;
        $audio[] = ['label' => room_import_media_label($url), 'url' => $url];
    };

    $walk = function (DOMNode $node, array $style = []) use (&$walk, &$sections, &$textBuffer, &$textStyle, $sourceUrl, $flushText, $rememberAudio): void {
        if (count($sections) >= 24) return;
        if ($node instanceof DOMText) {
            $text = trim($node->wholeText);
            if ($text !== '') {
                if ($textBuffer === '') $textStyle = $style;
                $textBuffer .= ' ' . $text;
            }
            return;
        }
        if (!$node instanceof DOMElement) {
            foreach ($node->childNodes as $child) $walk($child, $style);
            return;
        }
        $tag = strtolower($node->tagName);
        if (in_array($tag, ['script', 'style', 'noscript', 'iframe'], true)) return;

        foreach (['src', 'href', 'data', 'url', 'filename', 'FileName'] as $attr) {
            if ($node->hasAttribute($attr)) $rememberAudio(room_import_candidate_media_url((string)$node->getAttribute($attr), $sourceUrl));
        }
        if ($tag === 'param') {
            $rememberAudio(room_import_candidate_media_url((string)$node->getAttribute('value'), $sourceUrl));
        }
        if ($tag === 'img') {
            $flushText();
            $src = room_import_candidate_media_url((string)$node->getAttribute('src'), $sourceUrl);
            if ($src !== '') {
                $sections[] = [
                    'type' => 'image',
                    'src' => $src,
                    'alt' => trim((string)$node->getAttribute('alt')),
                    'width' => (int)$node->getAttribute('width') ?: null,
                    'height' => (int)$node->getAttribute('height') ?: null,
                ];
            }
            return;
        }
        $childStyle = room_import_style_from_node($node, $style);
        $isBlock = in_array($tag, ['address', 'article', 'aside', 'blockquote', 'center', 'div', 'footer', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'p', 'pre', 'section', 'table', 'tbody', 'td', 'th', 'tr', 'ul', 'ol', 'br'], true);
        if ($isBlock) $flushText();
        foreach ($node->childNodes as $child) $walk($child, $childStyle);
        if ($isBlock) $flushText();
    };

    if ($body) $walk($body, room_import_style_from_node($body));
    $flushText();

    $roleSet = false;
    foreach ($sections as &$section) {
        if (($section['type'] ?? '') === 'image' && !$roleSet) {
            $section['role'] = 'header';
            $roleSet = true;
        }
    }
    unset($section);

    if (preg_match_all('~https?://[^\s"\'<>]+\.(?:mp3|m4a|aac|ogg|oga|opus|wav|m3u|m3u8|pls|asx|wma)(?:[^\s"\'<>]*)~i', $html, $matches)) {
        foreach ($matches[0] as $url) $rememberAudio(room_import_candidate_media_url($url, $sourceUrl));
    }

    return [
        'source_url' => $sourceUrl,
        'title' => $title,
        'background_color' => $backgroundColor,
        'background_image' => $backgroundImage,
        'sections' => array_slice($sections, 0, 24),
        'music' => $audio,
    ];
}

function room_import_download_asset(string $url, string $kind): ?string {
    $max = $kind === 'audio' ? 24 * 1024 * 1024 : 12 * 1024 * 1024;
    try {
        $fetched = room_import_fetch_url($url, $max, $kind === 'audio' ? 'audio/*,*/*;q=0.6' : 'image/*,*/*;q=0.5', 3);
    } catch (Throwable $e) {
        return null;
    }
    $body = (string)$fetched['body'];
    if ($body === '') return null;
    $finfo = new finfo(FILEINFO_MIME_TYPE);
    $mime = $finfo->buffer($body) ?: '';
    $imageTypes = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp', 'image/gif' => 'gif'];
    $audioTypes = ['audio/mpeg' => 'mp3', 'audio/mp3' => 'mp3', 'audio/ogg' => 'ogg', 'audio/wav' => 'wav', 'audio/x-wav' => 'wav', 'audio/aac' => 'aac', 'audio/mp4' => 'm4a'];
    $types = $kind === 'audio' ? $audioTypes : $imageTypes;
    if (!isset($types[$mime])) return null;
    $dir = __DIR__ . '/../assets/uploads/imported-rooms';
    if (!is_dir($dir)) mkdir($dir, 0775, true);
    $file = bin2hex(random_bytes(12)) . '.' . $types[$mime];
    $dest = $dir . '/' . $file;
    if (file_put_contents($dest, $body, LOCK_EX) === false) return null;
    return '/assets/uploads/imported-rooms/' . $file;
}

function room_import_localize(array $preview): array {
    $layout = [
        'source_url' => $preview['source_url'] ?? '',
        'background_color' => $preview['background_color'] ?? '#000000',
        'sections' => [],
    ];
    $backgroundPath = '';
    if (!empty($preview['background_image'])) {
        $backgroundPath = room_import_download_asset((string)$preview['background_image'], 'image') ?: '';
    }
    foreach (($preview['sections'] ?? []) as $section) {
        if (!is_array($section)) continue;
        if (($section['type'] ?? '') === 'image') {
            $path = room_import_download_asset((string)($section['src'] ?? ''), 'image');
            if (!$path) continue;
            $layout['sections'][] = [
                'type' => 'image',
                'path' => $path,
                'alt' => (string)($section['alt'] ?? ''),
                'role' => (string)($section['role'] ?? ''),
            ];
        } elseif (($section['type'] ?? '') === 'text') {
            $text = trim((string)($section['text'] ?? ''));
            if ($text === '') continue;
            $layout['sections'][] = [
                'type' => 'text',
                'text' => $text,
                'style' => is_array($section['style'] ?? null) ? $section['style'] : [],
            ];
        }
    }
    $music = [];
    foreach (($preview['music'] ?? []) as $track) {
        if (!is_array($track)) continue;
        $url = (string)($track['url'] ?? '');
        if ($url === '') continue;
        $local = preg_match('~\.(?:mp3|m4a|aac|ogg|oga|opus|wav)(?:[?#].*)?$~i', $url)
            ? room_import_download_asset($url, 'audio')
            : null;
        $music[] = [
            'label' => (string)($track['label'] ?? room_import_media_label($url)),
            'url' => $local ?: $url,
            'local' => (bool)$local,
        ];
    }
    return ['layout' => $layout, 'music' => $music, 'background_path' => $backgroundPath];
}

function room_import_preview_from_url(string $url): array {
    $fetched = room_import_fetch_url($url, 3 * 1024 * 1024, 'text/html,application/xhtml+xml,*/*;q=0.4', 3);
    $preview = room_import_parse((string)$fetched['body'], (string)$fetched['url']);
    if (empty($preview['sections']) && empty($preview['music']) && empty($preview['background_image'])) {
        throw new RuntimeException('That page did not look like an importable VP-style room.');
    }
    return $preview;
}

function room_import_tile_image_from_layout(?string $layoutJson): string {
    if (!$layoutJson) return '';
    $layout = json_decode($layoutJson, true);
    if (!is_array($layout)) return '';
    foreach (($layout['sections'] ?? []) as $section) {
        if (is_array($section) && ($section['type'] ?? '') === 'image' && !empty($section['path'])) {
            return (string)$section['path'];
        }
    }
    return '';
}

function room_import_file_paths(?string $layoutJson, ?string $musicJson): array {
    $paths = [];
    foreach ([$layoutJson, $musicJson] as $json) {
        if (!$json) continue;
        $decoded = json_decode($json, true);
        $stack = is_array($decoded) ? [$decoded] : [];
        while ($stack) {
            $item = array_pop($stack);
            foreach ($item as $value) {
                if (is_array($value)) {
                    $stack[] = $value;
                } elseif (is_string($value) && str_starts_with($value, '/assets/uploads/imported-rooms/')) {
                    $paths[] = $value;
                }
            }
        }
    }
    return array_values(array_unique($paths));
}
