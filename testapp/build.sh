#!/usr/bin/env bash
# Builds the demo Java server used to exercise JVMScope end to end.
# Usage: ./build.sh   then:   java -jar dist/demo-server.jar 8000
set -euo pipefail
cd "$(dirname "$0")"

rm -rf build dist
mkdir -p build/classes dist

# -g keeps local variable names so Arthas's watch/trace output is more readable.
javac -g -d build/classes $(find src -name "*.java")

echo "Main-Class: com.example.demo.DemoServer" > build/manifest.txt
jar cfm dist/demo-server.jar build/manifest.txt -C build/classes .

echo "built dist/demo-server.jar"
