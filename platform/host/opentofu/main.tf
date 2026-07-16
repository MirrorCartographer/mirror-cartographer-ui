terraform {
  required_version = ">= 1.8.0"
  required_providers {
    hcloud = {
      source  = "hetznercloud/hcloud"
      version = "~> 1.50"
    }
  }
}

provider "hcloud" {
  token = var.hcloud_token
}

resource "hcloud_ssh_key" "foundation" {
  name       = "${var.name}-admin"
  public_key = var.ssh_public_key
}

resource "hcloud_firewall" "foundation" {
  name = "${var.name}-firewall"

  rule {
    direction = "in"
    protocol  = "tcp"
    port      = "22"
    source_ips = var.ssh_source_cidrs
  }

  rule {
    direction = "in"
    protocol  = "tcp"
    port      = "80"
    source_ips = ["0.0.0.0/0", "::/0"]
  }

  rule {
    direction = "in"
    protocol  = "tcp"
    port      = "443"
    source_ips = ["0.0.0.0/0", "::/0"]
  }
}

resource "hcloud_volume" "foundation_data" {
  name     = "${var.name}-data"
  size     = var.volume_size_gb
  location = var.location
  format   = "ext4"
}

resource "hcloud_server" "foundation" {
  name        = var.name
  image       = "ubuntu-24.04"
  server_type = var.server_type
  location    = var.location
  ssh_keys    = [hcloud_ssh_key.foundation.id]
  firewall_ids = [hcloud_firewall.foundation.id]
  user_data = templatefile("${path.module}/cloud-init.yaml.tftpl", {
    admin_user = var.admin_user
    domain     = var.domain
    repo_url   = var.repo_url
    repo_ref   = var.repo_ref
  })

  public_net {
    ipv4_enabled = true
    ipv6_enabled = true
  }
}

resource "hcloud_volume_attachment" "foundation_data" {
  volume_id = hcloud_volume.foundation_data.id
  server_id = hcloud_server.foundation.id
  automount = true
}

output "ipv4" {
  value = hcloud_server.foundation.ipv4_address
}

output "ipv6" {
  value = hcloud_server.foundation.ipv6_address
}

output "ssh_command" {
  value = "ssh ${var.admin_user}@${hcloud_server.foundation.ipv4_address}"
}

output "dns_records" {
  value = {
    A    = hcloud_server.foundation.ipv4_address
    AAAA = hcloud_server.foundation.ipv6_address
  }
}
