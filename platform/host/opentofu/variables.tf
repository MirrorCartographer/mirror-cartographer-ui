variable "hcloud_token" {
  type      = string
  sensitive = true
}

variable "ssh_public_key" {
  type      = string
  sensitive = true
}

variable "ssh_source_cidrs" {
  type        = list(string)
  description = "CIDRs allowed to reach SSH. Replace 0.0.0.0/0 with your actual address when possible."
  default     = ["0.0.0.0/0", "::/0"]
}

variable "name" {
  type    = string
  default = "foundation-intelligence"
}

variable "admin_user" {
  type    = string
  default = "foundation"
}

variable "domain" {
  type        = string
  description = "Public hostname, for example foundation.example.com"
}

variable "repo_url" {
  type    = string
  default = "https://github.com/MirrorCartographer/mirror-cartographer-ui.git"
}

variable "repo_ref" {
  type    = string
  default = "preview"
}

variable "server_type" {
  type    = string
  default = "cx22"
}

variable "location" {
  type    = string
  default = "ash"
}

variable "volume_size_gb" {
  type    = number
  default = 40
}
