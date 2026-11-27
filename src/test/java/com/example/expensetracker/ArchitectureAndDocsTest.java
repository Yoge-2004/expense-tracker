package com.example.expensetracker;

import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Deque;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import java.util.TreeSet;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Automated architecture and documentation fitness tests enforcing module acyclicity,
 * shared-package layering, import hygiene, top-level Javadoc coverage, and OpenAPI contract completeness.
 */
class ArchitectureAndDocsTest {

    private static final Path MAIN_JAVA = Path.of("src/main/java");
    private static final Pattern PACKAGE_PATTERN = Pattern.compile("(?m)^\\s*package\\s+([\\w.]+)\\s*;");
    private static final Pattern IMPORT_PATTERN = Pattern.compile("(?m)^\\s*import\\s+(?:static\\s+)?([\\w.*]+)\\s*;");
    private static final Pattern TOP_LEVEL_PUBLIC_TYPE = Pattern.compile(
            "(?m)^public\\s+(?:abstract\\s+|final\\s+|sealed\\s+|non-sealed\\s+|static\\s+)*(?:class|interface|record|enum|@interface)\\s+\\w+");
    private static final Pattern REST_CONTROLLER = Pattern.compile("@RestController\\b");
    private static final Pattern MAPPING_ANNOTATION = Pattern.compile(
            "@(?:GetMapping|PostMapping|PutMapping|DeleteMapping|PatchMapping|RequestMapping)\\b");
    private static final Pattern RESPONSE_CODE = Pattern.compile("responseCode\\s*=\\s*\"([^\"]+)\"");

    @Test
    void enforcesAcyclicModulesCleanCommonLayeringHygieneAndCompleteDocumentation() throws IOException {
        List<Path> javaFiles;
        try (var stream = Files.walk(MAIN_JAVA)) {
            javaFiles = stream.filter(p -> p.toString().endsWith(".java")).sorted().toList();
        }
        assertThat(javaFiles).isNotEmpty();

        List<String> commonOutboundViolations = new ArrayList<>();
        List<String> unusedImports = new ArrayList<>();
        List<String> requestBodyShadowing = new ArrayList<>();
        List<String> missingJavadoc = new ArrayList<>();
        List<String> missingControllerTag = new ArrayList<>();
        List<String> missingEndpointOperation = new ArrayList<>();
        List<String> missingEndpointApiResponse = new ArrayList<>();
        List<String> duplicateResponseCodes = new ArrayList<>();
        Map<String, Set<String>> moduleGraph = new TreeMap<>();

        for (Path file : javaFiles) {
            String src = Files.readString(file, StandardCharsets.UTF_8);
            String rel = MAIN_JAVA.relativize(file).toString().replace('\\', '/');

            Matcher pkgMatcher = PACKAGE_PATTERN.matcher(src);
            String pkg = pkgMatcher.find() ? pkgMatcher.group(1) : "";
            String sourceModule = topModule(pkg);

            MaskedSource masked = maskCommentsAndStrings(src);
            String noStr = masked.noStrings();
            String noComments = masked.noComments();
            String bodyNoStr = IMPORT_PATTERN.matcher(PACKAGE_PATTERN.matcher(noStr).replaceAll("")).replaceAll("");

            Matcher impMatcher = IMPORT_PATTERN.matcher(noStr);
            while (impMatcher.find()) {
                String imp = impMatcher.group(1);
                if (imp.startsWith("com.example.expensetracker.")) {
                    String targetPkg = imp.substring(0, imp.lastIndexOf('.'));
                    String targetModule = topModule(targetPkg);
                    if ("common".equals(sourceModule)
                            && (targetModule.startsWith("domain.") || targetModule.startsWith("infrastructure."))) {
                        commonOutboundViolations.add(rel + " -> " + imp);
                    }
                    if (!sourceModule.equals(targetModule) && !targetModule.isBlank()) {
                        moduleGraph.computeIfAbsent(sourceModule, _ -> new TreeSet<>()).add(targetModule);
                    }
                }
                if (!imp.endsWith(".*")) {
                    String symbol = imp.substring(imp.lastIndexOf('.') + 1);
                    if (!Pattern.compile("\\b" + Pattern.quote(symbol) + "\\b").matcher(bodyNoStr).find()) {
                        unusedImports.add(rel + ": " + imp);
                    }
                }
                if ("io.swagger.v3.oas.annotations.parameters.RequestBody".equals(imp)) {
                    requestBodyShadowing.add(rel);
                }
            }

            Matcher typeMatcher = TOP_LEVEL_PUBLIC_TYPE.matcher(noStr);
            if (typeMatcher.find() && !hasAdjacentJavadoc(masked.javadocSpans(), noComments, typeMatcher.start())) {
                missingJavadoc.add(rel);
            }

            if (REST_CONTROLLER.matcher(noStr).find()) {
                Matcher classDecl = Pattern.compile("(?m)^public\\s+(?:class|record)\\s+\\w+").matcher(noStr);
                if (classDecl.find()) {
                    String header = noStr.substring(0, classDecl.start());
                    if (!header.contains("@Tag")) {
                        missingControllerTag.add(rel);
                    }
                    int braceStart = noStr.indexOf('{', classDecl.end());
                    if (braceStart >= 0) {
                        inspectControllerEndpoints(
                                rel, src, noStr, noComments, braceStart,
                                missingEndpointOperation, missingEndpointApiResponse, duplicateResponseCodes);
                    }
                }
            }
        }

        List<List<String>> cycles = findStronglyConnectedComponents(moduleGraph);

        assertThat(commonOutboundViolations).as("common package must not depend on domain or infrastructure").isEmpty();
        assertThat(cycles).as("Cross-module dependency cycles (SCCs)").isEmpty();
        assertThat(unusedImports).as("Unused imports in src/main/java").isEmpty();
        assertThat(requestBodyShadowing).as("Swagger @RequestBody import shadowing Spring @RequestBody").isEmpty();
        assertThat(missingJavadoc).as("Top-level public types missing Javadoc").isEmpty();
        assertThat(missingControllerTag).as("@RestController classes missing @Tag").isEmpty();
        assertThat(missingEndpointOperation).as("Endpoint handlers missing @Operation").isEmpty();
        assertThat(missingEndpointApiResponse).as("Endpoint handlers missing @ApiResponse").isEmpty();
        assertThat(duplicateResponseCodes).as("Endpoint handlers with duplicate @ApiResponse responseCode").isEmpty();
    }

    private static void inspectControllerEndpoints(
            String rel,
            String rawSrc,
            String noStr,
            String noComments,
            int braceStart,
            List<String> missingOp,
            List<String> missingApiResp,
            List<String> dupCodes) {
        int depth = 1;
        int parenDepth = 0;
        int declStart = braceStart + 1;
        for (int i = braceStart + 1; i < noStr.length() && depth > 0; i++) {
            char c = noStr.charAt(i);
            if (c == '(') {
                parenDepth++;
            } else if (c == ')') {
                parenDepth--;
            } else if (c == '{') {
                if (depth == 1 && parenDepth == 0) {
                    String declNoStr = noStr.substring(declStart, i);
                    String declWithStr = noComments.substring(declStart, i);
                    if (MAPPING_ANNOTATION.matcher(declNoStr).find()) {
                        int line = lineNumber(rawSrc, declStart);
                        if (!declNoStr.contains("@Operation")) {
                            missingOp.add(rel + ":" + line);
                        }
                        if (!declNoStr.contains("@ApiResponse")) {
                            missingApiResp.add(rel + ":" + line);
                        }
                        List<String> codes = new ArrayList<>();
                        Set<String> seen = new HashSet<>();
                        Matcher m = RESPONSE_CODE.matcher(declWithStr);
                        while (m.find()) {
                            String code = m.group(1);
                            codes.add(code);
                            if (!seen.add(code)) {
                                dupCodes.add(rel + ":" + line + " duplicates " + codes);
                                break;
                            }
                        }
                    }
                }
                depth++;
            } else if (c == '}') {
                depth--;
                if (depth == 1 && parenDepth == 0) {
                    declStart = i + 1;
                }
            } else if (c == ';' && depth == 1 && parenDepth == 0) {
                declStart = i + 1;
            }
        }
    }

    private static boolean hasAdjacentJavadoc(List<int[]> javadocSpans, String noComments, int typeStart) {
        for (int[] span : javadocSpans) {
            if (span[1] > typeStart) {
                continue;
            }
            String between = noComments.substring(span[1], typeStart);
            if (isOnlyWhitespaceAndAnnotations(between)) {
                return true;
            }
        }
        return false;
    }

    private static boolean isOnlyWhitespaceAndAnnotations(String text) {
        int i = 0;
        int n = text.length();
        while (i < n) {
            char c = text.charAt(i);
            if (Character.isWhitespace(c)) {
                i++;
            } else if (c == '@') {
                i++;
                while (i < n && (Character.isLetterOrDigit(text.charAt(i)) || text.charAt(i) == '.' || text.charAt(i) == '_')) {
                    i++;
                }
                while (i < n && Character.isWhitespace(text.charAt(i))) {
                    i++;
                }
                if (i < n && text.charAt(i) == '(') {
                    int pd = 1;
                    i++;
                    while (i < n && pd > 0) {
                        if (text.charAt(i) == '(') {
                            pd++;
                        } else if (text.charAt(i) == ')') {
                            pd--;
                        }
                        i++;
                    }
                }
            } else {
                return false;
            }
        }
        return true;
    }

    private static int lineNumber(String src, int offset) {
        int lines = 1;
        for (int i = 0; i < Math.min(offset, src.length()); i++) {
            if (src.charAt(i) == '\n') {
                lines++;
            }
        }
        return lines;
    }

    private static String topModule(String pkg) {
        String[] parts = pkg.split("\\.");
        if (parts.length >= 5 && ("domain".equals(parts[3]) || "infrastructure".equals(parts[3]))) {
            return parts[3] + "." + parts[4];
        }
        if (parts.length >= 4) {
            return parts[3];
        }
        return pkg;
    }

    private static List<List<String>> findStronglyConnectedComponents(Map<String, Set<String>> graph) {
        Set<String> allNodes = new TreeSet<>(graph.keySet());
        graph.values().forEach(allNodes::addAll);

        Map<String, Integer> indices = new HashMap<>();
        Map<String, Integer> lowlink = new HashMap<>();
        Deque<String> stack = new ArrayDeque<>();
        Set<String> onStack = new HashSet<>();
        List<List<String>> sccs = new ArrayList<>();
        int[] indexCounter = {0};

        for (String node : allNodes) {
            if (!indices.containsKey(node)) {
                strongConnect(node, graph, indices, lowlink, stack, onStack, sccs, indexCounter);
            }
        }
        return sccs;
    }

    private static void strongConnect(
            String v,
            Map<String, Set<String>> graph,
            Map<String, Integer> indices,
            Map<String, Integer> lowlink,
            Deque<String> stack,
            Set<String> onStack,
            List<List<String>> sccs,
            int[] indexCounter) {
        indices.put(v, indexCounter[0]);
        lowlink.put(v, indexCounter[0]);
        indexCounter[0]++;
        stack.push(v);
        onStack.add(v);

        for (String w : graph.getOrDefault(v, Set.of())) {
            if (!indices.containsKey(w)) {
                strongConnect(w, graph, indices, lowlink, stack, onStack, sccs, indexCounter);
                lowlink.put(v, Math.min(lowlink.get(v), lowlink.get(w)));
            } else if (onStack.contains(w)) {
                lowlink.put(v, Math.min(lowlink.get(v), indices.get(w)));
            }
        }

        if (lowlink.get(v).equals(indices.get(v))) {
            List<String> component = new ArrayList<>();
            while (true) {
                String w = stack.pop();
                onStack.remove(w);
                component.add(w);
                if (w.equals(v)) {
                    break;
                }
            }
            if (component.size() > 1) {
                sccs.add(component);
            }
        }
    }

    private record MaskedSource(String noStrings, String noComments, List<int[]> javadocSpans) {}

    private static MaskedSource maskCommentsAndStrings(String src) {
        int n = src.length();
        char[] noComments = src.toCharArray();
        char[] noStr = src.toCharArray();
        List<int[]> javadocs = new ArrayList<>();
        int i = 0;
        while (i < n) {
            char c = src.charAt(i);
            if (c == '/' && i + 1 < n && src.charAt(i + 1) == '/') {
                int j = i;
                while (j < n && src.charAt(j) != '\n') {
                    noComments[j] = ' ';
                    noStr[j] = ' ';
                    j++;
                }
                i = j;
            } else if (c == '/' && i + 1 < n && src.charAt(i + 1) == '*') {
                boolean isJavadoc = i + 2 < n && src.charAt(i + 2) == '*' && (i + 3 >= n || src.charAt(i + 3) != '/');
                int j = i + 2;
                while (j + 1 < n && !(src.charAt(j) == '*' && src.charAt(j + 1) == '/')) {
                    j++;
                }
                int end = Math.min(j + 2, n);
                if (isJavadoc) {
                    javadocs.add(new int[]{i, end});
                }
                for (int k = i; k < end; k++) {
                    if (src.charAt(k) != '\n') {
                        noComments[k] = ' ';
                        noStr[k] = ' ';
                    }
                }
                i = end;
            } else if (i + 2 < n && c == '"' && src.charAt(i + 1) == '"' && src.charAt(i + 2) == '"') {
                int j = i + 3;
                while (j < n) {
                    if (src.charAt(j) == '\\') {
                        j += 2;
                        continue;
                    }
                    if (j + 2 < n && src.charAt(j) == '"' && src.charAt(j + 1) == '"' && src.charAt(j + 2) == '"') {
                        j += 3;
                        break;
                    }
                    j++;
                }
                int end = Math.min(j, n);
                for (int k = i + 3; k < Math.max(i + 3, end - 3); k++) {
                    if (src.charAt(k) != '\n') {
                        noStr[k] = ' ';
                    }
                }
                i = end;
            } else if (c == '"' || c == '\'') {
                int j = i + 1;
                while (j < n) {
                    if (src.charAt(j) == '\\') {
                        j += 2;
                        continue;
                    }
                    if (src.charAt(j) == c) {
                        j++;
                        break;
                    }
                    j++;
                }
                int end = Math.min(j, n);
                for (int k = i + 1; k < Math.max(i + 1, end - 1); k++) {
                    if (src.charAt(k) != '\n') {
                        noStr[k] = ' ';
                    }
                }
                i = end;
            } else {
                i++;
            }
        }
        return new MaskedSource(new String(noStr), new String(noComments), javadocs);
    }
}
