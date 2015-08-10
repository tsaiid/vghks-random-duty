require "rubygems"

desc "Deploy to Github Pages"
task :deploy do
  puts "## Deploying to Github Pages"

  cd "_site" do
    system "git checkout -- ."
    system "git pull"
  end

  puts "## Generating site"
  system "grunt copy"

  cd "_site" do
    system "git add -A"

    message = "vghks-random-duty updated at #{Time.now.utc}"
    puts "## Commiting: #{message}"
    system "git commit -m \"#{message}\""

    puts "## Pushing generated site"
    system "git push"

    puts "## Deploy Complete!"
  end
end
