@echo off
git add .
set /p commit_msg="Enter commit message (default: Update): "
if "%commit_msg%"=="" set commit_msg=Update
git commit -m "%commit_msg%"
git push
echo Done.
pause
