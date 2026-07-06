FROM alpine:3.22

ARG PB_VERSION=0.35.0

RUN apk add --no-cache ca-certificates unzip curl

ADD https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/pocketbase_${PB_VERSION}_linux_amd64.zip /tmp/pb.zip
RUN unzip /tmp/pb.zip -d /pb/ && chmod +x /pb/pocketbase

COPY deploy/family-games-pocketbase/pb_migrations /pb/pb_migrations
COPY deploy/family-games-pocketbase/pb_hooks /pb/pb_hooks
COPY deploy/family-games-pocketbase/pb_seed /pb/pb_seed
COPY deploy/family-games-pocketbase/entrypoint.sh /pb/entrypoint.sh

RUN find /pb/pb_migrations /pb/pb_hooks /pb/pb_seed -name '._*' -delete \
    && chmod +x /pb/entrypoint.sh

EXPOSE 8080

CMD ["/pb/entrypoint.sh"]
