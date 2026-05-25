# Backend Deployment

This repository deploys only the backend image.

Flow:

`git push main -> GitHub Actions build -> Docker Hub -> EC2 self-hosted runner -> docker compose -> nginx`

Required GitHub secrets:

```text
DOCKERHUB_USERNAME
DOCKERHUB_TOKEN
EC2_DOMAIN
BACKEND_ENV_FILE
```

`BACKEND_ENV_FILE` should contain the runtime values from `.env.example`.
If it does not include `ALLOWED_ORIGINS`, the workflow adds:

```text
https://EC2_DOMAIN,http://EC2_DOMAIN,http://localhost:5173
```

The workflow updates only the `backend` service on EC2. The frontend repo updates the `frontend` service.

## EC2 self-hosted runner

Register the EC2 instance as a GitHub Actions self-hosted runner for this repo and add this custom label:

```text
gss-ec2
```

Because frontend and backend are separate repositories, use one of these setups:

- Register one runner at GitHub organization/account level so both repos can use it.
- Or install two runner directories/services on the same EC2 instance, one registered to the frontend repo and one to the backend repo.

The deploy job uses:

```yaml
runs-on: [self-hosted, linux, gss-ec2]
```

Install runtime dependencies on EC2 before the first deploy:

```bash
sudo apt update
sudo apt install -y docker.io docker-compose-plugin nginx
sudo usermod -aG docker $USER
sudo systemctl enable --now docker nginx
```

The runner user must be able to run Docker and reload nginx. If the runner runs as user `actions`, add it to Docker and allow nginx commands:

```bash
sudo usermod -aG docker actions
sudo tee /etc/sudoers.d/github-actions-nginx >/dev/null <<'EOF'
actions ALL=(ALL) NOPASSWD: /usr/bin/mkdir, /usr/bin/chown, /usr/bin/tee, /usr/sbin/nginx, /usr/bin/systemctl reload nginx
EOF
```
