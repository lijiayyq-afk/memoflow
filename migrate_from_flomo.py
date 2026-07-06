# migrate_from_flomo.py - 将 flomo 历史数据迁移到 MemoFlow Cloudflare D1 关系型数据库中
import json
import re
import os
import uuid
import datetime

def main():
    print("==================================================")
    print("      MemoFlow - flomo 历史数据迁移工具 (D1 SQL)")
    print("==================================================")
    print()
    
    json_path = "flomo.json"
    if not os.path.exists(json_path):
        print(f"❌ 未检测到 '{json_path}' 文件！")
        print("说明：请先在 flomo 网页版中执行备份导出，解压后将其中的 'flomo.json' 文件移动到当前目录下（E:\\ai_code\\memoflow\\）。")
        return
        
    username = input("👉 请输入你在 MemoFlow 注册的【用户名】(用于关联笔记): ").strip()
    if not username:
        print("❌ 用户名不能为空！")
        return

    print(f"正在读取 {json_path} 并为账户名为 '{username}' 组装数据关系...")
    
    try:
        with open(json_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
    except Exception as e:
        print(f"❌ 读取 json 失败，原因: {e}")
        return

    memos_list = data.get("memos", [])
    if not memos_list:
        print("❌ 未在 json 中找到任何 'memos' 笔记数据。请确认使用的是正确的 flomo.json 备份文件。")
        return

    print(f"发现共 {len(memos_list)} 条笔记，正在智能提取标签并生成导入 SQL...")

    sql_lines = []
    sql_lines.append("-- MemoFlow Memos Data Import Script")
    sql_lines.append("PRAGMA foreign_keys = ON;\n")
    
    memo_count = 0
    tag_set = set() 
    memo_tags_list = [] 
    
    for item in memos_list:
        content = item.get("content", "").strip()
        if not content:
            continue
            
        created_at = item.get("created_at", "")
        if not created_at:
            created_at = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            
        memo_id = f"memo-{uuid.uuid4().hex[:12]}"
        escaped_content = content.replace("'", "''")
        
        # 1. 组装 memos 插入语句 (使用 Select 子查询动态绑定对应用户的 id)
        sql_memos = f"INSERT INTO memos (id, user_id, content, is_archived, created_at, updated_at) VALUES ('{memo_id}', (SELECT id FROM users WHERE username = '{username}'), '{escaped_content}', 0, '{created_at}', '{created_at}');"
        sql_lines.append(sql_memos)
        
        # 2. 匹配 #标签 语法
        tags_found = re.findall(r'#([^\s#]+)', content)
        for tag_name in tags_found:
            tag_name = tag_name.rstrip(".,;!?，。；！？")
            if tag_name:
                tag_set.add(tag_name)
                memo_tags_list.append((memo_id, tag_name))
                
        memo_count += 1

    # 3. 插入 tags 表 (INSERT OR IGNORE 避免重复)
    sql_lines.append("\n-- 批量生成标签分类")
    for tag in tag_set:
        tag_id = f"tag-{uuid.uuid4().hex[:12]}"
        escaped_tag = tag.replace("'", "''")
        sql_lines.append(f"INSERT OR IGNORE INTO tags (id, user_id, name, created_at) VALUES ('{tag_id}', (SELECT id FROM users WHERE username = '{username}'), '{escaped_tag}', datetime('now'));")

    # 4. 插入多对多映射
    sql_lines.append("\n-- 批量建立笔记-标签关联")
    for memo_id, tag_name in memo_tags_list:
        escaped_tag = tag_name.replace("'", "''")
        sql_lines.append(f"INSERT INTO memo_tags (memo_id, tag_id) VALUES ('{memo_id}', (SELECT id FROM tags WHERE user_id = (SELECT id FROM users WHERE username = '{username}') AND name = '{escaped_tag}'));")

    # 写入 SQL 归档
    out_sql_path = "import_memos.sql"
    try:
        with open(out_sql_path, "w", encoding="utf-8") as f:
            f.write("\n".join(sql_lines))
    except Exception as e:
        print(f"❌ 写入 {out_sql_path} 失败: {e}")
        return

    print()
    print("==================================================")
    print(f" 🎉 转换成功！共解析导入了 {memo_count} 条 Memo，提取了 {len(tag_set)} 个标签分类。")
    print(f" 转换后的 SQL 脚本已保存在: {out_sql_path}")
    print("==================================================")
    print()
    print("👉 【接下来只需最后一步即可完成迁移】")
    print("请双击运行当前目录下刚刚为你生成的: run_import.bat")
    print("或者在当前工作目录下执行以下命令，即可一键把历史笔记同步入云端数据库中:")
    print(" npx wrangler d1 execute memoflow-db --remote --file=import_memos.sql")
    print()
    
    # 自动生成一键导入 BAT
    bat_content = f"@echo off\ntitle MemoFlow Memos Importer\necho 正在将历史数据导入到 Cloudflare 云端 D1 数据库中...\ncall npx wrangler d1 execute memoflow-db --remote --file=import_memos.sql\necho.\necho ==================================================\necho  🎉 历史数据一键迁移成功！\necho ==================================================\npause\n"
    with open("run_import.bat", "w", encoding="gbk") as bf:
        bf.write(bat_content)

if __name__ == "__main__":
    main()
