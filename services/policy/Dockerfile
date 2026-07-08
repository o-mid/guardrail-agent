FROM golang:1.22-alpine AS build
WORKDIR /src
COPY go.mod go.sum* ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -o /out/policy ./cmd/policy

FROM alpine:3.20
WORKDIR /app
COPY --from=build /out/policy /app/policy
COPY config /config
EXPOSE 8090
ENV PORT=8090
ENV POLICY_DEFAULTS_PATH=/config/default-policy.json
CMD ["/app/policy"]
