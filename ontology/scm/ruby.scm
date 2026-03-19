;; Ruby import resolution nodes
;; Captures the require path for LSP resolution

; require 'rails'
; require_relative '../lib/helper'
(call
  method: (identifier) @method_name
  (#match? @method_name "^(require|require_relative)$")
  arguments: (argument_list
    (string) @scm.resolution_node))

;; TODO: Add queries for ast-x:visibility (Ruby uses method calls: private, protected, public)
;; TODO: Add queries for ast-x:isStatic (class methods: def self.method_name)
;; TODO: Add queries for ast-x:isOptional (parameters with default values: param = defaultValue)
