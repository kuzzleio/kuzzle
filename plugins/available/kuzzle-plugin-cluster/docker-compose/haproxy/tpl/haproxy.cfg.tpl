global
  daemon

defaults
  balance roundrobin
  mode http
  option forwardfor
  option http-server-close
  timeout connect   5s
  timeout client    5s
  timeout server    5s
  timeout tunnel    2h
  stats enable
  stats refresh 30s
  stats show-node
  stats auth kuzzle:kuzzle
  stats uri /hastats

listen stats
  bind *:7575

frontend kuzzle
  bind *:7512
  {{range $services := service "kuzzle"}}acl  is_{{.Node}} path_beg /{{.Node}}/
  use_backend {{.Node}} if is_{{.Node}}
  {{end}}
  default_backend kuzzle

backend kuzzle
  # * http: prefer "roundrobin"
  # * socket.io: either disable long polling transport on client side or switch
  #   to "source" balancing
  balance leastconn
  option forceclose
  no option httpclose
  option httpchk GET /_plugin/cluster/health
  {{range $services := service "kuzzle"}}server {{.Node}}  {{.Address}}:7512 check inter 10000
  {{end}}

{{range $services := service "kuzzle"}}
backend {{.Node}}
  balance roundrobin
  option forwardfor
  http-request set-path %[path,regsub("^/{{.Node}}","")]
  server {{.Node}} {{.Address}}:7512
{{end}}

