;; Elixir import resolution nodes
;; Captures the module name for LSP resolution
;;
;; Elixir has four import-like directives: import, require, alias, use.
;; All are `call` nodes with specific target identifiers.
;; The alias (module name) is the resolution target for LSP.

; import Foo
(call
  target: (identifier) @_import
  (#eq? @_import "import")
  (arguments
    (alias) @scm.resolution_node)) @scm.import

; require Foo
(call
  target: (identifier) @_require
  (#eq? @_require "require")
  (arguments
    (alias) @scm.resolution_node)) @scm.import

; alias Foo
(call
  target: (identifier) @_alias
  (#eq? @_alias "alias")
  (arguments
    (alias) @scm.resolution_node)) @scm.import

; use Foo
(call
  target: (identifier) @_use
  (#eq? @_use "use")
  (arguments
    (alias) @scm.resolution_node)) @scm.import

;; Protocol implementation — defimpl Protocol, for: Type
;; The protocol alias is the "extends" target
(call
  target: (identifier) @_defimpl
  (#eq? @_defimpl "defimpl")
  (arguments
    (alias) @scm.extends_clause))

;; @behaviour Foo — behavior adoption (interface implementation)
(unary_operator
  operator: "@"
  operand: (call
    target: (identifier) @_behaviour
    (#eq? @_behaviour "behaviour")
    (arguments
      (alias) @scm.extends_clause)))

;; TODO: Add queries for ast-x:visibility (Elixir uses def vs defp — public vs private)
;; TODO: Add queries for ast-x:isStatic (not applicable — Elixir is functional)
;; TODO: Add queries for ast-x:docstring (@doc/@moduledoc attributes)
