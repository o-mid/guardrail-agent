package validate

import (
	"bytes"
	"encoding/json"
	"fmt"

	"github.com/santhosh-tekuri/jsonschema/v5"
)

type SchemaValidator struct {
	schema *jsonschema.Schema
}

func NewSchemaValidator(schemaJSON []byte) (*SchemaValidator, error) {
	c := jsonschema.NewCompiler()
	c.Draft = jsonschema.Draft2020
	if err := c.AddResource("plan.schema.json", bytes.NewReader(schemaJSON)); err != nil {
		return nil, err
	}
	s, err := c.Compile("plan.schema.json")
	if err != nil {
		return nil, err
	}
	return &SchemaValidator{schema: s}, nil
}

func (v *SchemaValidator) Validate(plan any) []string {
	if err := v.schema.Validate(plan); err != nil {
		return []string{fmt.Sprintf("%v", err)}
	}
	return nil
}

func DecodePlan(raw json.RawMessage) (any, error) {
	var plan any
	dec := json.NewDecoder(bytes.NewReader(raw))
	dec.UseNumber()
	if err := dec.Decode(&plan); err != nil {
		return nil, err
	}
	return plan, nil
}
