;; Dart import resolution nodes
;; Captures the import URI for LSP resolution

; import 'package:flutter/material.dart';
(import_specification
  (string_literal) @scm.resolution_node)

;; TODO: Add queries for ast-x:visibility (_ prefix = private, otherwise public)
;; TODO: Add queries for ast-x:isStatic (static class members)
;; TODO: Add queries for ast-x:isOptional (optional parameters: [param] or {param} or param = defaultValue)
