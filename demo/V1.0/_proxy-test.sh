#!/usr/bin/env bash
# v6 LLM 代理连通性测试
set +e

cd "D:/AI_Codex/Projects/program3-r/demo/V1.0"

# 先确保没有遗留进程
pkill -f "llm-proxy.mjs" 2>/dev/null
sleep 1

# 启动代理到后台
C:/Users/pp678/.workbuddy/binaries/node/versions/22.22.2/node.exe llm-proxy.mjs > /tmp/proxy.log 2>&1 &
PID=$!
sleep 1

echo "=== proxy.log 启动输出 ==="
cat /tmp/proxy.log
echo
echo

echo "=== 1: OPTIONS preflight (should be HTTP 204) ==="
curl -sS -o /dev/null -w "  HTTP %{http_code}\n" -X OPTIONS http://127.0.0.1:8787/llm

echo "=== 2: wrong path (should be HTTP 404 + JSON hint) ==="
curl -sS -o /tmp/c.txt -w "  HTTP %{http_code}  body=" -X POST http://127.0.0.1:8787/wrong
cat /tmp/c.txt
echo

echo "=== 3: empty body (should be HTTP 400 + JSON hint) ==="
curl -sS -o /tmp/c.txt -w "  HTTP %{http_code}  body=" -X POST http://127.0.0.1:8787/llm
cat /tmp/c.txt
echo

echo "=== 4: forward to DeepSeek without key (expect upstream 401; verifies CORS bridge works) ==="
curl -sS -o /tmp/c.txt -w "  HTTP %{http_code}  body=" -X POST http://127.0.0.1:8787/llm \
  -H "Content-Type: application/json" \
  -d '{"model":"deepseek-chat","messages":[{"role":"user","content":"ping"}]}'
head -c 400 /tmp/c.txt
echo

# 关掉代理
kill $PID 2>/dev/null
wait 2>/dev/null
pkill -f "llm-proxy.mjs" 2>/dev/null
echo "=== proxy closed ==="
