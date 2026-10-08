class Kissopen < Formula
  desc "Command-line coding assistant for KissOpen"
  homepage "https://kissopen.com"
  url "https://registry.npmjs.org/@kissopen/kissopen-terminal/-/kissopen-terminal-0.3.8.tgz"
  sha256 "b776ed619683e7aae5c0a84f4aee9d10b654d3a8914417e4c83fb38bfb1129f8"
  license "MIT"

  depends_on "node@24"

  def install
    system Formula["node@24"].opt_bin/"npm", "install", "--global", "--prefix", libexec,
           "--omit=dev", "--no-audit", "--no-fund", "--registry=https://registry.npmjs.org", cached_download
    (bin/"kissopen").write_env_script libexec/"bin/kissopen",
                                    PATH: "#{Formula["node@24"].opt_bin}:$PATH"
  end

  def caveats
    <<~EOS
      Start an interactive session with: kissopen
      Agent auto-download currently supports Windows x64 and Linux x64 / ARM64.
      The standalone macOS Agent release is still being prepared.
    EOS
  end

  test do
    assert_match "KISSOPEN Terminal #{version}", shell_output("#{bin}/kissopen --version")
    assert_match "Usage: kissopen", shell_output("#{bin}/kissopen --help")
  end
end
