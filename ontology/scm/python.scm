;; Python import resolution nodes
;; Captures the module/package name nodes for LSP resolution

; import sys
(import_statement
  name: (dotted_name) @scm.resolution_node)

; from jmespath import functions
(import_from_statement
  module_name: (dotted_name) @scm.resolution_node)

; from __future__ import annotations
(future_import_statement
  name: (dotted_name) @scm.resolution_node)

;; TODO: Add queries for ast-x:visibility (Python uses _ convention, not enforced)
;; TODO: Add queries for ast-x:isStatic (@staticmethod decorator)
;; TODO: Add queries for ast-x:isOptional (parameters with default values: param = defaultValue)

;; ast-x:ExtendsClause — Python reuses argument_list for everything,
;; so we match only when parent is class_definition.
;; class Foo(Bar, Baz):
(class_definition
  superclasses: (argument_list) @scm.extends_clause)
